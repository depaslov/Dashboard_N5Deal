import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { assertProjectAccess } from '@/lib/project'

export const dynamic = 'force-dynamic'

const VALID_CATEGORIES = ['ai', 'brand', 'compliance', 'competitor', 'other']
const VALID_SEVERITIES = ['warn', 'block']
const VALID_LANGUAGES = ['any', 'en', 'uk', 'ru']

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id as string | undefined
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const existing = await prisma.redFlagWord.findUnique({ where: { id: params.id } })
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
  if (typeof body?.word === 'string' && body.word.trim().length > 0) updates.word = body.word.trim()
  if (VALID_CATEGORIES.includes(body?.category)) updates.category = body.category
  if (VALID_SEVERITIES.includes(body?.severity)) updates.severity = body.severity
  if (VALID_LANGUAGES.includes(body?.language)) updates.language = body.language
  if (typeof body?.reason === 'string') updates.reason = body.reason.trim() || null

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  try {
    const updated = await prisma.redFlagWord.update({ where: { id: params.id }, data: updates })
    return NextResponse.json({ word: updated })
  } catch (err: any) {
    if (err?.code === 'P2002') {
      return NextResponse.json({ error: 'Word already exists in this language' }, { status: 409 })
    }
    console.error('red-flag update error', err)
    return NextResponse.json({ error: 'Could not update' }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id as string | undefined
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const existing = await prisma.redFlagWord.findUnique({ where: { id: params.id } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const hasAccess = await assertProjectAccess(userId, existing.projectId)
  if (!hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  await prisma.redFlagWord.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
