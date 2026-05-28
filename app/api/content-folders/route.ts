import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getOrCreateCurrentProject } from '@/lib/project'

export const dynamic = 'force-dynamic'

const CreateSchema = z.object({
  name: z.string().min(1).max(120),
  color: z.string().max(32).optional(),
})

// GET — list folders for the current project, each with a content count.
export async function GET() {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id as string | undefined
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const project = await getOrCreateCurrentProject(userId)
  const folders = await prisma.contentFolder.findMany({
    where: { projectId: project.id },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    include: { _count: { select: { contents: true } } },
  })

  return NextResponse.json({
    folders: folders.map((f) => ({
      id: f.id,
      name: f.name,
      color: f.color,
      sortOrder: f.sortOrder,
      count: f._count.contents,
    })),
  })
}

// POST — create a new folder. Name must be unique within the project.
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

  // Next sortOrder = max + 1 so new folders append to the end.
  const max = await prisma.contentFolder.aggregate({
    where: { projectId: project.id },
    _max: { sortOrder: true },
  })
  const sortOrder = (max._max.sortOrder ?? -1) + 1

  try {
    const folder = await prisma.contentFolder.create({
      data: {
        projectId: project.id,
        name: parsed.data.name.trim(),
        color: parsed.data.color ?? null,
        sortOrder,
      },
    })
    return NextResponse.json({ folder: { id: folder.id, name: folder.name, color: folder.color, sortOrder: folder.sortOrder, count: 0 } })
  } catch (err: any) {
    // Unique constraint (projectId, name)
    if (err?.code === 'P2002') {
      return NextResponse.json({ error: 'A folder with this name already exists' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Could not create folder' }, { status: 500 })
  }
}
