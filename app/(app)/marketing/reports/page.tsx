import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getOrCreateCurrentProject } from '@/lib/project'
import { ReportsBoard } from './reports-board'

export const dynamic = 'force-dynamic'

export default async function MarketingReportsPage({ searchParams }: { searchParams: { id?: string } }) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id as string
  const project = await getOrCreateCurrentProject(userId)

  const reports = await prisma.marketingReport.findMany({
    where: { projectId: project.id },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      title: true,
      periodLabel: true,
      createdAt: true,
      imgCount: true,
    },
  })

  const selectedId = searchParams.id ?? reports[0]?.id ?? null
  const selected = selectedId
    ? await prisma.marketingReport.findUnique({
        where: { id: selectedId },
      })
    : null

  // Make sure the requested report actually belongs to this project
  const selectedSafe = selected && selected.projectId === project.id ? selected : null

  return (
    <ReportsBoard
      reports={reports.map((r) => ({
        id: r.id,
        title: r.title,
        periodLabel: r.periodLabel,
        createdAt: r.createdAt.toISOString(),
        imgCount: r.imgCount,
      }))}
      selected={
        selectedSafe
          ? {
              id: selectedSafe.id,
              title: selectedSafe.title,
              periodLabel: selectedSafe.periodLabel,
              html: selectedSafe.html ?? '',
              notes: selectedSafe.notes ?? '',
              notesByChannel: (selectedSafe.notesByChannel as Record<string, string> | null) ?? {},
              metrics: (selectedSafe.metrics as Record<string, Record<string, number | null>> | null) ?? {},
              createdAt: selectedSafe.createdAt.toISOString(),
            }
          : null
      }
    />
  )
}
