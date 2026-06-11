import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getOrCreateCurrentProject } from '@/lib/project'
import { LB_TASK_LIKE_TYPES } from '@/lib/marketing/constants'
import { LinkBuildingBoard, type LbItem } from '../linkbuilding/lb-board'

export const dynamic = 'force-dynamic'

// Tasks page is the non-link-building side of the LinkBuildingItem
// table. Same model, same form, same activity log, same views — just
// filtered to the task-like type family (task, article, market_news,
// medium, seo) so the team can use the board as a general work tracker
// without muddying the Link Building section that's specifically about
// outreach / placements / earning backlinks.
export default async function MarketingTasksPage({
  searchParams,
}: {
  searchParams: { view?: string; month?: string }
}) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id as string
  const project = await getOrCreateCurrentProject(userId)

  const [items, members] = await Promise.all([
    prisma.linkBuildingItem.findMany({
      where: {
        projectId: project.id,
        type: { in: [...LB_TASK_LIKE_TYPES] },
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
      mode="tasks"
      items={data}
      members={memberOptions}
      initialView={(searchParams.view as 'list' | 'calendar' | 'board') ?? 'list'}
      anchorMonthISO={searchParams.month ?? new Date().toISOString()}
    />
  )
}
