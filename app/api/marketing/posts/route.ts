import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getOrCreateCurrentProject } from '@/lib/project'

export const dynamic = 'force-dynamic'

const PostSchema = z.object({
  accountId: z.string().min(1),
  type: z.string().min(1).max(60),
  title: z.string().min(1).max(500),
  content: z.string().max(20_000).optional(),
  platforms: z.array(z.string()).default([]),
  scheduledFor: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)),
  status: z.enum(['idea', 'wip', 'done', 'pub', 'skip']).default('idea'),
  postUrl: z.string().url().optional().or(z.literal('')),
  notes: z.string().max(5_000).optional(),
  images: z.array(z.string()).optional(),
})

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id as string | undefined
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const project = await getOrCreateCurrentProject(userId)
  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const accountId = searchParams.get('accountId') || undefined

  const posts = await prisma.socialPost.findMany({
    where: {
      projectId: project.id,
      ...(accountId ? { accountId } : {}),
      ...(from || to
        ? {
            scheduledFor: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lt: new Date(to) } : {}),
            },
          }
        : {}),
    },
    include: { account: { select: { id: true, slug: true, name: true, color: true } } },
    orderBy: { scheduledFor: 'asc' },
  })
  return NextResponse.json({ posts })
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
  const parsed = PostSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid fields' },
      { status: 400 },
    )
  }
  // Ensure account belongs to the project
  const acc = await prisma.socialAccount.findUnique({ where: { id: parsed.data.accountId } })
  if (!acc || acc.projectId !== project.id) {
    return NextResponse.json({ error: 'Account not found in this project' }, { status: 400 })
  }
  const post = await prisma.socialPost.create({
    data: {
      projectId: project.id,
      accountId: parsed.data.accountId,
      type: parsed.data.type,
      title: parsed.data.title,
      content: parsed.data.content ?? null,
      platforms: parsed.data.platforms,
      scheduledFor: new Date(parsed.data.scheduledFor),
      status: parsed.data.status,
      postUrl: parsed.data.postUrl || null,
      notes: parsed.data.notes ?? null,
      images: parsed.data.images?.length ? parsed.data.images : undefined,
      createdById: userId,
    },
  })
  return NextResponse.json({ post })
}
