import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getOrCreateCurrentProject } from '@/lib/project'
import { LB_TASK_LIKE_TYPES } from '@/lib/marketing/constants'
import { LinkBuildingBoard, type LbItem } from './lb-board'

export const dynamic = 'force-dynamic'

export default async function MarketingLinkBuildingPage({
  searchParams,
}: {
  searchParams: { view?: string; month?: string }
}) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id as string
  const project = await getOrCreateCurrentProject(userId)

  // Only true link-placement items here — anything in the task-like
  // family (task / article / market_news / medium / seo) lives on the
  // Tasks page. Single source of truth for which types route to which
  // page is LB_TASK_LIKE_TYPES in lib/marketing/constants.ts.
  const [items, members] = await Promise.all([
    prisma.linkBuildingItem.findMany({
      where: {
        projectId: project.id,
        type: { notIn: [...LB_TASK_LIKE_TYPES] },
      },
      orderBy: { scheduledFor: 'asc' },
    }),
    prisma.projectMember.findMany({
      where: { projectId: project.id },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'asc' },
    }),
  ])

  const data: LbItem[] = items.map((i) => ({
    id: i.id,
    title: i.title,
    targetSite: i.targetSite ?? '',
    contactName: i.contactName ?? '',
    contactEmail: i.contactEmail ?? '',
    anchorText: i.anchorText ?? '',
    destinationUrl: i.destinationUrl ?? '',
    type: i.type,
    status: i.status,
    scheduledFor: i.scheduledFor.toISOString(),
    publishedDate: i.publishedDate?.toISOString() ?? null,
    liveUrl: i.liveUrl ?? '',
    dr: i.dr,
    cost: i.cost,
    notes: i.notes ?? '',
    assigneeIds: i.assigneeIds ?? [],
  }))

  const memberOptions = members.map((m) => ({
    id: m.userId,
    name: m.user.name ?? m.user.email ?? '?',
    email: m.user.email ?? '',
  }))

  return (
    <LinkBuildingBoard
      mode="links"
      items={data}
      members={memberOptions}
      initialView={(searchParams.view as 'list' | 'calendar' | 'board') ?? 'list'}
      anchorMonthISO={searchParams.month ?? new Date().toISOString()}
    />
  )
}
