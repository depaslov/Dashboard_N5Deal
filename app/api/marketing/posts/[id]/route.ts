import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { assertProjectAccess } from '@/lib/project'

export const dynamic = 'force-dynamic'

const UpdateSchema = z.object({
  accountId: z.string().min(1).optional(),
  type: z.string().min(1).max(60).optional(),
  title: z.string().min(1).max(500).optional(),
  content: z.string().max(20_000).nullable().optional(),
  platforms: z.array(z.string()).optional(),
  scheduledFor: z.string().optional(),
  status: z.enum(['idea', 'wip', 'done', 'pub', 'skip']).optional(),
  postUrl: z.string().url().optional().or(z.literal('')).optional(),
  notes: z.string().max(5_000).nullable().optional(),
  images: z.array(z.string()).optional(),
})

async function loadPostForUser(id: string, userId: string) {
  const post = await prisma.socialPost.findUnique({ where: { id } })
  if (!post) return null
  const ok = await assertProjectAccess(userId, post.projectId)
  if (!ok) return null
  return post
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id as string | undefined
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const post = await prisma.socialPost.findUnique({
    where: { id: params.id },
    include: { account: true, createdBy: { select: { id: true, name: true, email: true } } },
  })
  if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const ok = await assertProjectAccess(userId, post.projectId)
  if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ post })
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id as string | undefined
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const existing = await loadPostForUser(params.id, userId)
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

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
  const data: Record<string, unknown> = { ...parsed.data }
  if (parsed.data.scheduledFor) data.scheduledFor = new Date(parsed.data.scheduledFor)
  if (parsed.data.postUrl === '') data.postUrl = null
  if (Array.isArray(parsed.data.images)) data.images = parsed.data.images

  // If accountId changes, ensure it still belongs to the same project
  if (parsed.data.accountId && parsed.data.accountId !== existing.accountId) {
    const acc = await prisma.socialAccount.findUnique({ where: { id: parsed.data.accountId } })
    if (!acc || acc.projectId !== existing.projectId) {
      return NextResponse.json({ error: 'Account not found in this project' }, { status: 400 })
    }
  }

  const post = await prisma.socialPost.update({ where: { id: params.id }, data })
  return NextResponse.json({ post })
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id as string | undefined
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const existing = await loadPostForUser(params.id, userId)
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  await prisma.socialPost.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
