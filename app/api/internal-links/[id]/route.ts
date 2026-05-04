import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { assertProjectAccess } from '@/lib/project'

export const dynamic = 'force-dynamic'

const VALID_PRIORITIES = ['must', 'nice']

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id as string | undefined
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const existing = await prisma.internalLink.findUnique({ where: { id: params.id } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const hasAccess = await assertProjectAccess(userId, existing.projectId)
  if (!hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const updates: any = {}
  if (typeof body?.url === 'string' && body.url.trim().length > 0) updates.url = body.url.trim()
  if (typeof body?.anchor === 'string' && body.anchor.trim().length > 0) updates.anchor = body.anchor.trim()
  if (Array.isArray(body?.anchorAlts)) {
    updates.anchorAlts = body.anchorAlts.map((s: any) => String(s ?? '').trim()).filter(Boolean)
  }
  if (typeof body?.context === 'string') updates.context = body.context.trim() || null
  if (typeof body?.category === 'string') updates.category = body.category.trim() || null
  if (VALID_PRIORITIES.includes(body?.priority)) updates.priority = body.priority
  if (typeof body?.isActive === 'boolean') updates.isActive = body.isActive

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  try {
    const updated = await prisma.internalLink.update({ where: { id: params.id }, data: updates })
    return NextResponse.json({ link: updated })
  } catch (err: any) {
    if (err?.code === 'P2002') {
      return NextResponse.json({ error: 'Another link already uses this URL' }, { status: 409 })
    }
    console.error('internal-link update error', err)
    return NextResponse.json({ error: 'Could not update' }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id as string | undefined
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const existing = await prisma.internalLink.findUnique({ where: { id: params.id } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const hasAccess = await assertProjectAccess(userId, existing.projectId)
  if (!hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  await prisma.internalLink.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
