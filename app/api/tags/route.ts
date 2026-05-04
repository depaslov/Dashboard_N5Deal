import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getOrCreateCurrentProject } from '@/lib/project'

export const dynamic = 'force-dynamic'

const NAME_MAX = 50
const COLOR_RE = /^#[0-9a-fA-F]{6}$/

function coerceTagInput(body: any): { name: string; color: string | null } | { error: string } {
  const name = String(body?.name ?? '').trim()
  if (!name) return { error: 'Name is required' }
  if (name.length > NAME_MAX) return { error: `Name must be at most ${NAME_MAX} characters` }
  let color: string | null = null
  if (body?.color !== undefined && body?.color !== null && body?.color !== '') {
    const c = String(body.color).trim()
    if (!COLOR_RE.test(c)) return { error: 'Color must be a hex string like #RRGGBB' }
    color = c
  }
  return { name, color }
}

export async function GET(_req: Request) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id as string | undefined
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const project = await getOrCreateCurrentProject(userId)
  const tags = await prisma.tag.findMany({
    where: { projectId: project.id },
    orderBy: { name: 'asc' },
  })
  return NextResponse.json({ tags })
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id as string | undefined
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const parsed = coerceTagInput(body)
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 })

  const project = await getOrCreateCurrentProject(userId)
  try {
    const tag = await prisma.tag.create({
      data: { projectId: project.id, name: parsed.name, color: parsed.color },
    })
    return NextResponse.json({ tag }, { status: 201 })
  } catch (err: any) {
    if (err?.code === 'P2002') {
      return NextResponse.json({ error: 'A tag with this name already exists' }, { status: 409 })
    }
    console.error('tag create error', err)
    return NextResponse.json({ error: 'Could not create tag' }, { status: 500 })
  }
}
