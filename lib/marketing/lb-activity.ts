import { prisma } from '@/lib/db'

// Tiny helper used by the linkbuilding routes to record an audit-trail
// event in one shared place. Keeps the route files readable + makes sure
// we always snapshot the operator's name and the item title at write-time
// (so the feed stays human-readable after the user is renamed or the item
// is deleted).
//
// Per operator decision the journal only captures KEY events — created,
// deleted, approved, unapproved. Generic field edits and routine status
// shuffles aren't logged; they'd bury the signal we actually want to see.

export type LbActivityAction = 'created' | 'deleted' | 'approved' | 'unapproved'

export async function logLbActivity(args: {
  projectId: string
  itemId: string | null
  itemTitle: string
  action: LbActivityAction
  userId: string | null
  metadata?: Record<string, unknown>
}): Promise<void> {
  let userName: string | null = null
  if (args.userId) {
    const u = await prisma.user.findUnique({
      where: { id: args.userId },
      select: { name: true, email: true },
    })
    userName = u?.name ?? u?.email ?? null
  }
  await prisma.linkBuildingActivity.create({
    data: {
      projectId: args.projectId,
      itemId: args.itemId,
      itemTitle: args.itemTitle,
      action: args.action,
      userId: args.userId,
      userName,
      metadata: (args.metadata as object) ?? {},
    },
  })
}
