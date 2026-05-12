import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getOrCreateCurrentProject } from '@/lib/project'

export const dynamic = 'force-dynamic'

const TYPES = ['outreach', 'guest_post', 'resource', 'partner', 'directory', 'hari', 'other'] as const
const STATUSES = ['planned', 'in_progress', 'followup', 'published', 'declined'] as const

const CreateSchema = z.object({
  title: z.string().min(1).max(300),
  targetSite: z.string().max(300).optional().nullable(),
  contactName: z.string().max(200).optional().nullable(),
  contactEmail: z.string().email().max(200).optional().or(z.literal('')).nullable(),
  anchorText: z.string().max(300).optional().nullable(),
  destinationUrl: z.string().max(500).optional().nullable(),
  type: z.enum(TYPES).default('outreach'),
  status: z.enum(STATUSES).default('planned'),
  scheduledFor: z.string(),
  publishedDate: z.string().optional().nullable(),
  liveUrl: z.string().max(500).optional().nullable(),
  dr: z.number().int().min(0).max(100).optional().nullable(),
  cost: z.number().nonnegative().optional().nullable(),
  notes: z.string().max(10_000).optional().nullable(),
})

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id as string | undefined
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const project = await getOrCreateCurrentProject(userId)
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') ?? undefined
  const type = searchParams.get('type') ?? undefined

  const items = await prisma.linkBuildingItem.findMany({
    where: {
      projectId: project.id,
      ...(status ? { status } : {}),
      ...(type ? { type } : {}),
    },
    orderBy: { scheduledFor: 'desc' },
  })
  return NextResponse.json({ items })
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

  const item = await prisma.linkBuildingItem.create({
    data: {
      projectId: project.id,
      createdById: userId,
      title: parsed.data.title,
      targetSite: parsed.data.targetSite || null,
      contactName: parsed.data.contactName || null,
      contactEmail: parsed.data.contactEmail || null,
      anchorText: parsed.data.anchorText || null,
      destinationUrl: parsed.data.destinationUrl || null,
      type: parsed.data.type,
      status: parsed.data.status,
      scheduledFor: new Date(parsed.data.scheduledFor),
      publishedDate: parsed.data.publishedDate ? new Date(parsed.data.publishedDate) : null,
      liveUrl: parsed.data.liveUrl || null,
      dr: parsed.data.dr ?? null,
      cost: parsed.data.cost ?? null,
      notes: parsed.data.notes || null,
    },
  })
  return NextResponse.json({ item })
}
