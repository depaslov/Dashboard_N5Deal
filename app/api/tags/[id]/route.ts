import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { assertProjectAccess } from '@/lib/project'

export const dynamic = 'force-dynamic'

const NAME_MAX = 50
const COLOR_RE = /^#[0-9a-fA-F]{6}$/

async function getTagOrNull(userId: string, id: string) {
  const tag = await prisma.tag.findUnique({ where: { id } })
  if (!tag) return null
  const ok = await assertProjectAccess(userId, tag.projectId)
  return ok ? tag : null
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id as string | undefined
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const existing = await getTagOrNull(userId, params.id)
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const data: { name?: string; color?: string | null } = {}
  if (body?.name !== undefined) {
    const n = String(body.name).trim()
    if (!n) return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 })
    if (n.length > NAME_MAX) {
      return NextResponse.json({ error: `Name must be at most ${NAME_MAX} characters` }, { status: 400 })
    }
    data.name = n
  }
  if (body?.color !== undefined) {
    if (body.color === null || body.color === '') {
      data.color = null
    } else {
      const c = String(body.color).trim()
      if (!COLOR_RE.test(c)) {
        return NextResponse.json({ error: 'Color must be a hex string like #RRGGBB' }, { status: 400 })
      }
      data.color = c
    }
  }
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  try {
    const tag = await prisma.tag.update({ where: { id: params.id }, data })
    return NextResponse.json({ tag })
  } catch (err: any) {
    if (err?.code === 'P2002') {
      return NextResponse.json({ error: 'A tag with this name already exists' }, { status: 409 })
    }
    console.error('tag update error', err)
    return NextResponse.json({ error: 'Could not update tag' }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id as string | undefined
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const existing = await getTagOrNull(userId, params.id)
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.tag.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
