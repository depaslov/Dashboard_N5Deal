import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { assertProjectAccess } from '@/lib/project'
import { logLbActivity } from '@/lib/marketing/lb-activity'

export const dynamic = 'force-dynamic'

const TYPES = ['outreach', 'guest_post', 'resource', 'partner', 'directory', 'hari', 'other'] as const
const STATUSES = ['planned', 'in_progress', 'approved', 'followup', 'published', 'declined'] as const

const PatchSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  targetSite: z.string().max(300).nullable().optional(),
  contactName: z.string().max(200).nullable().optional(),
  contactEmail: z.string().email().max(200).or(z.literal('')).nullable().optional(),
  anchorText: z.string().max(300).nullable().optional(),
  destinationUrl: z.string().max(500).nullable().optional(),
  type: z.enum(TYPES).optional(),
  status: z.enum(STATUSES).optional(),
  scheduledFor: z.string().optional(),
  publishedDate: z.string().nullable().optional(),
  liveUrl: z.string().max(500).nullable().optional(),
  dr: z.number().int().min(0).max(100).nullable().optional(),
  cost: z.number().nonnegative().nullable().optional(),
  notes: z.string().max(10_000).nullable().optional(),
})

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id as string | undefined
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const existing = await prisma.linkBuildingItem.findUnique({ where: { id: params.id } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const ok = await assertProjectAccess(userId, existing.projectId)
  if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid fields' }, { status: 400 })
  }

  const data: Record<string, unknown> = { ...parsed.data }
  if (parsed.data.scheduledFor) data.scheduledFor = new Date(parsed.data.scheduledFor)
  if (parsed.data.publishedDate !== undefined) {
    data.publishedDate = parsed.data.publishedDate ? new Date(parsed.data.publishedDate) : null
  }
  if (parsed.data.contactEmail === '') data.contactEmail = null

  const item = await prisma.linkBuildingItem.update({ where: { id: params.id }, data })

  // Log status transitions in/out of 'approved' so the Activity timeline
  // shows when each task was signed off. Other field edits are intentionally
  // not logged — operator asked for only key events (created/deleted/approved)
  // to keep the feed signal-to-noise high.
  if (parsed.data.status && parsed.data.status !== existing.status) {
    if (parsed.data.status === 'approved') {
      await logLbActivity({
        projectId: existing.projectId,
        itemId: item.id,
        itemTitle: item.title,
        action: 'approved',
        userId,
      })
    } else if (existing.status === 'approved') {
      // Moving AWAY from approved — useful to see in the log because it
      // means someone reverted an approval (e.g. caught a problem before
      // publishing).
      await logLbActivity({
        projectId: existing.projectId,
        itemId: item.id,
        itemTitle: item.title,
        action: 'unapproved',
        userId,
        metadata: { newStatus: parsed.data.status },
      })
    }
  }

  return NextResponse.json({ item })
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id as string | undefined
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const existing = await prisma.linkBuildingItem.findUnique({ where: { id: params.id } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const ok = await assertProjectAccess(userId, existing.projectId)
  if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Log BEFORE the delete so we capture the title snapshot while we still
  // have the row. itemId is left non-null here so the activity row stays
  // linked to whatever's left of the item (Prisma onDelete: SetNull on
  // LinkBuildingActivity.itemId nulls it automatically when the item row
  // is then removed by the cascade — see schema).
  await logLbActivity({
    projectId: existing.projectId,
    itemId: existing.id,
    itemTitle: existing.title,
    action: 'deleted',
    userId,
  })
  await prisma.linkBuildingItem.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
