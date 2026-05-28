import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { assertProjectAccess } from '@/lib/project'

export const dynamic = 'force-dynamic'

const UpdateSchema = z.object({
  generatedBrief: z.string().max(200_000).optional(),
  topic: z.string().min(1).max(500).optional(),
  targetAudience: z.string().max(500).optional(),
  keyMessages: z.string().max(5_000).optional(),
  tone: z.string().max(500).optional(),
  // Move to a folder (null = remove from folder / uncategorised).
  folderId: z.string().nullable().optional(),
})

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id as string | undefined
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const content = await prisma.generatedContent.findUnique({
    where: { id: params.id },
    include: { icps: { include: { icp: { select: { id: true, name: true } } } } },
  })
  if (!content) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const ok = await assertProjectAccess(userId, content.projectId)
  if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ content })
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id as string | undefined
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const content = await prisma.generatedContent.findUnique({ where: { id: params.id } })
  if (!content) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const ok = await assertProjectAccess(userId, content.projectId)
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
  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  // If moving to a folder, ensure that folder exists in the SAME project.
  if (parsed.data.folderId) {
    const folder = await prisma.contentFolder.findUnique({ where: { id: parsed.data.folderId } })
    if (!folder || folder.projectId !== content.projectId) {
      return NextResponse.json({ error: 'Folder not found in this project' }, { status: 400 })
    }
  }

  const updated = await prisma.generatedContent.update({
    where: { id: params.id },
    data: parsed.data,
  })
  return NextResponse.json({ content: updated })
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id as string | undefined
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const content = await prisma.generatedContent.findUnique({ where: { id: params.id } })
  if (!content) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const ok = await assertProjectAccess(userId, content.projectId)
  if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  await prisma.generatedContent.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
