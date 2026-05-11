import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { assertProjectAccess } from '@/lib/project'

export const dynamic = 'force-dynamic'

const PatchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  tagline: z.string().max(500).nullable().optional(),
  pitch: z.string().max(5_000).nullable().optional(),
  notes: z.string().max(5_000).nullable().optional(),
  features: z.array(z.string().max(500)).optional(),
  deliverables: z.array(z.object({
    id: z.string(),
    text: z.string().max(500),
    status: z.enum(['todo', 'inprogress', 'done']),
    priority: z.enum(['urgent', 'high', 'medium', 'low']),
  })).optional(),
})

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id as string | undefined
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const existing = await prisma.brand.findUnique({ where: { id: params.id } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const ok = await assertProjectAccess(userId, existing.projectId)
  if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid fields' },
      { status: 400 },
    )
  }
  const brand = await prisma.brand.update({ where: { id: params.id }, data: parsed.data })
  return NextResponse.json({ brand })
}
