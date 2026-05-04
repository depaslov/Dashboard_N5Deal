import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getOrCreateCurrentProject } from '@/lib/project'

export const dynamic = 'force-dynamic'

const VALID_CONTENT_TYPES = [
  'articles', 'pages', 'market-news', 'newsletter', 'social', 'link-building',
  // legacy:
  'article', 'catalog', 'linkedin', 'telegram',
]

interface ParsedInput {
  name: string
  contentType: string
  platformId: string | null
  systemTemplate: string
  userTemplate: string
  variables: string[]
  isDefault: boolean
  isActive: boolean
}

function coerce(body: any, partial = false): ParsedInput | { error: string } {
  const out: Partial<ParsedInput> = {}

  if (body?.name !== undefined || !partial) {
    const n = String(body?.name ?? '').trim()
    if (!n) return { error: 'Name is required' }
    out.name = n
  }
  if (body?.contentType !== undefined || !partial) {
    const ct = String(body?.contentType ?? '').trim()
    if (!ct) return { error: 'contentType is required' }
    if (!VALID_CONTENT_TYPES.includes(ct)) {
      return { error: `contentType must be one of: ${VALID_CONTENT_TYPES.join(', ')}` }
    }
    out.contentType = ct
  }
  if (body?.platformId !== undefined) {
    out.platformId = body.platformId ? String(body.platformId) : null
  } else if (!partial) {
    out.platformId = null
  }
  if (body?.systemTemplate !== undefined || !partial) {
    out.systemTemplate = String(body?.systemTemplate ?? '')
  }
  if (body?.userTemplate !== undefined || !partial) {
    const ut = String(body?.userTemplate ?? '')
    if (!ut.trim()) return { error: 'userTemplate is required' }
    out.userTemplate = ut
  }
  if (body?.variables !== undefined) {
    out.variables = Array.isArray(body.variables)
      ? body.variables.map((x: any) => String(x ?? '').trim()).filter(Boolean)
      : []
  } else if (!partial) {
    out.variables = []
  }
  if (body?.isDefault !== undefined) out.isDefault = body.isDefault === true
  else if (!partial) out.isDefault = false
  if (body?.isActive !== undefined) out.isActive = body.isActive !== false
  else if (!partial) out.isActive = true

  return out as ParsedInput
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id as string | undefined
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const project = await getOrCreateCurrentProject(userId)
  const { searchParams } = new URL(req.url)
  const contentType = searchParams.get('contentType') || undefined
  const platformId = searchParams.get('platformId') || undefined
  const includeInactive = searchParams.get('includeInactive') === 'true'

  const templates = await prisma.promptTemplate.findMany({
    where: {
      projectId: project.id,
      ...(contentType ? { contentType } : {}),
      ...(platformId ? { platformId } : {}),
      ...(includeInactive ? {} : { isActive: true }),
    },
    orderBy: [{ contentType: 'asc' }, { isDefault: 'desc' }, { name: 'asc' }],
    include: { platform: { select: { id: true, name: true, slug: true } } },
  })
  return NextResponse.json({ templates })
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id as string | undefined
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: any
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const parsed = coerce(body, false)
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 })

  const project = await getOrCreateCurrentProject(userId)

  // Verify platform belongs to this project if provided
  if (parsed.platformId) {
    const p = await prisma.platform.findUnique({ where: { id: parsed.platformId } })
    if (!p || p.projectId !== project.id) {
      return NextResponse.json({ error: 'Platform not found in this project' }, { status: 404 })
    }
  }

  try {
    const template = await prisma.promptTemplate.create({
      data: { projectId: project.id, ...parsed },
    })
    return NextResponse.json({ template }, { status: 201 })
  } catch (err: any) {
    if (err?.code === 'P2002') {
      return NextResponse.json({ error: 'A template with this name already exists' }, { status: 409 })
    }
    console.error('template create error', err)
    return NextResponse.json({ error: 'Could not create template' }, { status: 500 })
  }
}
