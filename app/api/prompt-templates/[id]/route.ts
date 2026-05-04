import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { assertProjectAccess } from '@/lib/project'

export const dynamic = 'force-dynamic'

const VALID_CONTENT_TYPES = [
  'articles', 'pages', 'market-news', 'newsletter', 'social', 'link-building',
  'article', 'catalog', 'linkedin', 'telegram',
]

async function getOrNull(userId: string, id: string) {
  const t = await prisma.promptTemplate.findUnique({ where: { id } })
  if (!t) return null
  const ok = await assertProjectAccess(userId, t.projectId)
  return ok ? t : null
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id as string | undefined
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const t = await getOrNull(userId, params.id)
  if (!t) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ template: t })
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id as string | undefined
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const existing = await getOrNull(userId, params.id)
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let body: any
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const data: Record<string, any> = {}
  if (body?.name !== undefined) {
    const n = String(body.name).trim()
    if (!n) return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 })
    data.name = n
  }
  if (body?.contentType !== undefined) {
    const ct = String(body.contentType).trim()
    if (!VALID_CONTENT_TYPES.includes(ct)) {
      return NextResponse.json({ error: `contentType must be one of: ${VALID_CONTENT_TYPES.join(', ')}` }, { status: 400 })
    }
    data.contentType = ct
  }
  if (body?.platformId !== undefined) data.platformId = body.platformId ? String(body.platformId) : null
  if (body?.systemTemplate !== undefined) data.systemTemplate = String(body.systemTemplate)
  if (body?.userTemplate !== undefined) {
    const ut = String(body.userTemplate)
    if (!ut.trim()) return NextResponse.json({ error: 'userTemplate cannot be empty' }, { status: 400 })
    data.userTemplate = ut
  }
  if (body?.variables !== undefined) {
    data.variables = Array.isArray(body.variables)
      ? body.variables.map((x: any) => String(x ?? '').trim()).filter(Boolean)
      : []
  }
  if (body?.isDefault !== undefined) data.isDefault = body.isDefault === true
  if (body?.isActive !== undefined) data.isActive = body.isActive !== false

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  try {
    const template = await prisma.promptTemplate.update({ where: { id: params.id }, data })
    return NextResponse.json({ template })
  } catch (err: any) {
    if (err?.code === 'P2002') {
      return NextResponse.json({ error: 'A template with this name already exists' }, { status: 409 })
    }
    console.error('template update error', err)
    return NextResponse.json({ error: 'Could not update template' }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id as string | undefined
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const existing = await getOrNull(userId, params.id)
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  await prisma.promptTemplate.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
