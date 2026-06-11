import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getOrCreateCurrentProject } from '@/lib/project'
import { LinkBuildingBoard, type LbItem } from '../linkbuilding/lb-board'

export const dynamic = 'force-dynamic'

// Tasks Andrew is the non-link side of the LinkBuildingItem table. Same
// model, same form, same activity log, same views — just type === 'task'
// so the team can use the board as a general work tracker without
// muddying the Link Building section that's specifically about placements.
export default async function MarketingTasksAndrewPage({
  searchParams,
}: {
  searchParams: { view?: string; month?: string }
}) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id as string
  const project = await getOrCreateCurrentProject(userId)

  const items = await prisma.linkBuildingItem.findMany({
    where: { projectId: project.id, type: 'task' },
    orderBy: { scheduledFor: 'asc' },
  })

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
  }))

  return (
    <LinkBuildingBoard
      mode="tasks"
      items={data}
      initialView={(searchParams.view as 'list' | 'calendar' | 'board') ?? 'list'}
      anchorMonthISO={searchParams.month ?? new Date().toISOString()}
    />
  )
}
