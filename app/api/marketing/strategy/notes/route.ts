import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getOrCreateCurrentProject } from '@/lib/project'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const CreateSchema = z.object({
  title: z.string().min(1).max(300),
  // 500K-char cap on the HTML — enough to paste a long doc, far below
  // Postgres TEXT limits, protects against accidental multi-MB pastes.
  html: z.string().min(1).max(500_000),
  sortOrder: z.number().int().optional(),
})

export async function GET() {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id as string | undefined
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const project = await getOrCreateCurrentProject(userId)
  const notes = await prisma.strategyNote.findMany({
    where: { projectId: project.id },
    orderBy: [{ sortOrder: 'asc' }, { updatedAt: 'desc' }],
  })
  return NextResponse.json({ notes })
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id as string | undefined
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const project = await getOrCreateCurrentProject(userId)

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid fields' }, { status: 400 })
  }

  // Default sortOrder to "last" so a fresh note shows at the bottom
  // unless the operator passes a specific value.
  const last = await prisma.strategyNote.findFirst({
    where: { projectId: project.id },
    orderBy: { sortOrder: 'desc' },
    select: { sortOrder: true },
  })
  const sortOrder = parsed.data.sortOrder ?? (last?.sortOrder != null ? last.sortOrder + 1 : 0)

  const note = await prisma.strategyNote.create({
    data: {
      projectId: project.id,
      title: parsed.data.title,
      html: parsed.data.html,
      sortOrder,
    },
  })
  return NextResponse.json({ note })
}
