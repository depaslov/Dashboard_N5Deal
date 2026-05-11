import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getOrCreateCurrentProject } from '@/lib/project'
import { BarChart3 } from 'lucide-react'
import { AnalyticsBoard, type ReportSeries } from './analytics-board'

export const dynamic = 'force-dynamic'

export default async function MarketingAnalyticsPage() {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id as string
  const project = await getOrCreateCurrentProject(userId)

  // Pull every report in chronological order — analytics is a time-series view.
  const reports = await prisma.marketingReport.findMany({
    where: { projectId: project.id },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      title: true,
      periodLabel: true,
      createdAt: true,
      metrics: true,
    },
  })

  if (reports.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card py-16 px-6 text-center">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 mb-4">
          <BarChart3 className="h-6 w-6 text-primary" />
        </div>
        <h3 className="font-semibold">No analytics data yet</h3>
        <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
          Analytics charts appear here once you have at least one report. Head to{' '}
          <strong>Reports</strong> to upload analytics screenshots and let the AI build your first
          dataset.
        </p>
      </div>
    )
  }

  const series: ReportSeries[] = reports.map((r) => ({
    id: r.id,
    title: r.title,
    periodLabel: r.periodLabel,
    createdAt: r.createdAt.toISOString(),
    metrics: (r.metrics as Record<string, Record<string, number | null>> | null) ?? {},
  }))

  return <AnalyticsBoard series={series} />
}
