import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { assertProjectAccess } from '@/lib/project'

export const dynamic = 'force-dynamic'

const VALID_LANGUAGES = ['en', 'uk', 'ru']

function slugify(phrase: string): string {
  return phrase
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120) || 'entry'
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id as string | undefined
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const existing = await prisma.glossaryEntry.findUnique({ where: { id: params.id } })
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
  if (typeof body?.phrase === 'string' && body.phrase.trim().length > 0) {
    updates.phrase = body.phrase.trim()
    updates.slug = slugify(updates.phrase)
  }
  if (typeof body?.definition === 'string' && body.definition.trim().length > 0) {
    updates.definition = body.definition.trim()
  }
  if (VALID_LANGUAGES.includes(body?.language)) updates.language = body.language

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  try {
    const updated = await prisma.glossaryEntry.update({ where: { id: params.id }, data: updates })
    return NextResponse.json({ entry: updated })
  } catch (err: any) {
    if (err?.code === 'P2002') {
      return NextResponse.json({ error: 'Phrase already exists in this language' }, { status: 409 })
    }
    console.error('glossary update error', err)
    return NextResponse.json({ error: 'Could not update' }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id as string | undefined
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const existing = await prisma.glossaryEntry.findUnique({ where: { id: params.id } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const hasAccess = await assertProjectAccess(userId, existing.projectId)
  if (!hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  await prisma.glossaryEntry.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
