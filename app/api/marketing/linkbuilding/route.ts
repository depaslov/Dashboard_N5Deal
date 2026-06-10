import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getOrCreateCurrentProject } from '@/lib/project'
import { logLbActivity } from '@/lib/marketing/lb-activity'

export const dynamic = 'force-dynamic'

const TYPES = ['outreach', 'guest_post', 'resource', 'partner', 'directory', 'hari', 'other'] as const
// `approved` is the explicit gate between in_progress and published — see
// LB_STATUSES in lib/marketing/constants.ts for the workflow narrative.
const STATUSES = ['planned', 'in_progress', 'approved', 'followup', 'published', 'declined'] as const

// Title is the only required field — everything else falls back to a sane
// default (planned status, today's date, outreach type) so the operator
// can dump a quick idea into the system without filling the whole form,
// then expand it later. Matches how operators actually work — they think
// of a task before they think of the date and the destination URL.
const CreateSchema = z.object({
  title: z.string().min(1).max(300),
  targetSite: z.string().max(300).optional().nullable(),
  contactName: z.string().max(200).optional().nullable(),
  contactEmail: z.string().email().max(200).optional().or(z.literal('')).nullable(),
  anchorText: z.string().max(300).optional().nullable(),
  destinationUrl: z.string().max(500).optional().nullable(),
  type: z.enum(TYPES).default('outreach'),
  status: z.enum(STATUSES).default('planned'),
  scheduledFor: z.string().optional().nullable(),
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
      // No date supplied? Default to today — operator can refine later.
      // We keep the column NOT NULL because half the views (Calendar,
      // upcoming-this-week filters) depend on it; today is a safer
      // default than "epoch" or "year 9999".
      scheduledFor: typeof parsed.data.scheduledFor === 'string' && parsed.data.scheduledFor
        ? new Date(parsed.data.scheduledFor)
        : new Date(),
      publishedDate: parsed.data.publishedDate ? new Date(parsed.data.publishedDate) : null,
      liveUrl: parsed.data.liveUrl || null,
      dr: parsed.data.dr ?? null,
      cost: parsed.data.cost ?? null,
      notes: parsed.data.notes || null,
    },
  })

  // Two events at once if the task was created already-approved (rare but
  // possible via Import plan or operator picking 'approved' in the modal):
  // record the creation and then a separate 'approved' line so the timeline
  // shows the approval step explicitly.
  await logLbActivity({
    projectId: project.id,
    itemId: item.id,
    itemTitle: item.title,
    action: 'created',
    userId,
  })
  if (item.status === 'approved') {
    await logLbActivity({
      projectId: project.id,
      itemId: item.id,
      itemTitle: item.title,
      action: 'approved',
      userId,
    })
  }

  return NextResponse.json({ item })
}
