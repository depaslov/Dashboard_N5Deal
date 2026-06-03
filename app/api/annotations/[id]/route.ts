import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { assertProjectAccess } from '@/lib/project'

export const dynamic = 'force-dynamic'

const PatchSchema = z.object({
  note: z.string().max(20_000).optional(),
  resolved: z.boolean().optional(),
})

async function loadAndCheck(userId: string, annotationId: string) {
  const ann = await prisma.contentAnnotation.findUnique({
    where: { id: annotationId },
    include: { content: { select: { projectId: true } } },
  })
  if (!ann) return null
  const ok = await assertProjectAccess(userId, ann.content.projectId)
  if (!ok) return null
  return ann
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id as string | undefined
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ann = await loadAndCheck(userId, params.id)
  if (!ann) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid fields' }, { status: 400 })
  }

  const updated = await prisma.contentAnnotation.update({
    where: { id: params.id },
    data: parsed.data,
  })
  return NextResponse.json({ annotation: updated })
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id as string | undefined
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ann = await loadAndCheck(userId, params.id)
  if (!ann) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.contentAnnotation.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
