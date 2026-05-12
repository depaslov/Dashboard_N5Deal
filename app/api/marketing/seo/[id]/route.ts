import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { assertProjectAccess } from '@/lib/project'

export const dynamic = 'force-dynamic'

const INTENTS = ['informational', 'commercial', 'transactional', 'navigational'] as const

const PatchSchema = z.object({
  keyword: z.string().min(1).max(300).optional(),
  targetUrl: z.string().max(500).nullable().optional(),
  currentUrl: z.string().max(500).nullable().optional(),
  position: z.number().int().min(1).max(200).nullable().optional(),
  impressions: z.number().int().nonnegative().nullable().optional(),
  clicks: z.number().int().nonnegative().nullable().optional(),
  volume: z.number().int().nonnegative().nullable().optional(),
  difficulty: z.number().int().min(0).max(100).nullable().optional(),
  cluster: z.string().max(100).nullable().optional(),
  intent: z.enum(INTENTS).optional(),
  locale: z.string().max(20).optional(),
  isActive: z.boolean().optional(),
  notes: z.string().max(5_000).nullable().optional(),
})

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id as string | undefined
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const existing = await prisma.seoKeyword.findUnique({ where: { id: params.id } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const ok = await assertProjectAccess(userId, existing.projectId)
  if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid fields' }, { status: 400 })
  }

  // Track previousPosition + bump lastChecked when position changes
  const data: Record<string, unknown> = { ...parsed.data }
  if ('position' in parsed.data && parsed.data.position !== existing.position) {
    data.previousPosition = existing.position
    data.lastChecked = new Date()
  }

  const item = await prisma.seoKeyword.update({ where: { id: params.id }, data })
  return NextResponse.json({ item })
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id as string | undefined
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const existing = await prisma.seoKeyword.findUnique({ where: { id: params.id } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const ok = await assertProjectAccess(userId, existing.projectId)
  if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.seoKeyword.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
