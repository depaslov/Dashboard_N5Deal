import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getOrCreateCurrentProject } from '@/lib/project'

export const dynamic = 'force-dynamic'

const TYPES = ['about', 'team', 'products', 'facts', 'links', 'press', 'timeline', 'mission', 'values', 'other'] as const

const CreateSchema = z.object({
  title: z.string().min(1).max(300),
  type: z.enum(TYPES).default('about'),
  content: z.string().max(50_000).default(''),
  isPublished: z.boolean().default(false),
})

export async function GET() {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id as string | undefined
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const project = await getOrCreateCurrentProject(userId)
  const sections = await prisma.companyInfoSection.findMany({
    where: { projectId: project.id },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  })
  return NextResponse.json({ sections })
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

  const max = await prisma.companyInfoSection.aggregate({
    where: { projectId: project.id },
    _max: { sortOrder: true },
  })
  const sortOrder = (max._max.sortOrder ?? -1) + 1

  const section = await prisma.companyInfoSection.create({
    data: {
      projectId: project.id,
      title: parsed.data.title,
      type: parsed.data.type,
      content: parsed.data.content,
      isPublished: parsed.data.isPublished,
      sortOrder,
      source: 'manual',
    },
  })
  return NextResponse.json({ section })
}
