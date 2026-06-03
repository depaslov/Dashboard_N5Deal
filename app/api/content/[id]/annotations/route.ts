import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { assertProjectAccess } from '@/lib/project'

export const dynamic = 'force-dynamic'

const CreateSchema = z.object({
  selectedText: z.string().min(1).max(2_000),
  note: z.string().max(20_000).default(''),
  contextBefore: z.string().max(500).nullable().optional(),
  contextAfter: z.string().max(500).nullable().optional(),
})

// GET — list all annotations for a piece of content, oldest-first so they
// appear in the order they were added.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id as string | undefined
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const content = await prisma.generatedContent.findUnique({ where: { id: params.id } })
  if (!content) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const ok = await assertProjectAccess(userId, content.projectId)
  if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const annotations = await prisma.contentAnnotation.findMany({
    where: { contentId: params.id },
    orderBy: { createdAt: 'asc' },
  })
  return NextResponse.json({ annotations })
}

// POST — create a new annotation against this content.
export async function POST(req: Request, { params }: { params: { id: string } }) {
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
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid fields' }, { status: 400 })
  }

  const annotation = await prisma.contentAnnotation.create({
    data: {
      contentId: params.id,
      selectedText: parsed.data.selectedText,
      note: parsed.data.note,
      contextBefore: parsed.data.contextBefore ?? null,
      contextAfter: parsed.data.contextAfter ?? null,
    },
  })
  return NextResponse.json({ annotation })
}
