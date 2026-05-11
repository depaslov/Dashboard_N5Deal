import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { assertProjectAccess } from '@/lib/project'

export const dynamic = 'force-dynamic'

const UpdateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  periodLabel: z.string().max(100).optional(),
  notes: z.string().max(20_000).nullable().optional(),
  notesByChannel: z.record(z.string(), z.string()).optional(),
})

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id as string | undefined
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const existing = await prisma.marketingReport.findUnique({ where: { id: params.id } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const ok = await assertProjectAccess(userId, existing.projectId)
  if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const parsed = UpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid fields' },
      { status: 400 },
    )
  }
  const report = await prisma.marketingReport.update({
    where: { id: params.id },
    data: parsed.data,
  })
  return NextResponse.json({ report })
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id as string | undefined
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const existing = await prisma.marketingReport.findUnique({ where: { id: params.id } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const ok = await assertProjectAccess(userId, existing.projectId)
  if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.marketingReport.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
