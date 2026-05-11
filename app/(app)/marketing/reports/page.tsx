import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getOrCreateCurrentProject } from '@/lib/project'
import { BarChart3, FileText } from 'lucide-react'
import { format } from 'date-fns'

export const dynamic = 'force-dynamic'

export default async function MarketingReportsPage() {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id as string
  const project = await getOrCreateCurrentProject(userId)

  const reports = await prisma.marketingReport.findMany({
    where: { projectId: project.id },
    orderBy: { createdAt: 'desc' },
  })

  return (
    <div className="space-y-4">
      <header className="flex items-baseline justify-between">
        <div>
          <h2 className="font-display text-2xl font-semibold tracking-tight">Marketing Reports</h2>
          <p className="text-sm text-muted-foreground">
            AI-generated channel reports from analytics screenshots.
          </p>
        </div>
      </header>

      {reports.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card py-16 px-6 text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 mb-4">
            <BarChart3 className="h-6 w-6 text-primary" />
          </div>
          <h3 className="font-semibold">No reports yet</h3>
          <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
            Upload screenshots of Instagram Insights, YouTube Studio, LinkedIn Analytics, and Google Analytics
            to auto-generate a structured monthly report.
          </p>
          <p className="text-xs text-muted-foreground mt-4">
            Report generation (with Anthropic API integration) is part of Marketing OS Phase 3 — coming next.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {reports.map((r) => (
            <div key={r.id} className="bg-card border border-border rounded-lg shadow-sm p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    {r.periodLabel}
                  </p>
                  <h3 className="font-semibold text-sm mt-1 truncate">{r.title}</h3>
                </div>
                <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Created {format(r.createdAt, 'd LLL yyyy')}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
