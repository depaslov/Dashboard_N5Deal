import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getOrCreateCurrentProject } from '@/lib/project'
import { PageHeader } from '@/components/app/page-header'
import { NewReportButton } from '@/components/app/new-report-button'
import { FileText, Target } from 'lucide-react'

export const dynamic = 'force-dynamic'

// Monthly operational reports — now stored in the DB (OperationalReport) and
// editable from the UI. Each report lives at /reports/[slug].
export default async function ReportsIndexPage() {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id as string
  const project = await getOrCreateCurrentProject(userId)

  const reports = await prisma.operationalReport.findMany({
    where: { projectId: project.id },
    orderBy: { sortKey: 'desc' },
    select: { id: true, slug: true, title: true, subtitle: true, periodLabel: true, kind: true },
  })

  return (
    <div className="max-w-[1100px] mx-auto">
      <PageHeader
        title="Reports"
        description="Місячні звіти по контенту, лінкбілдингу та роботі над дашбордом. Клікніть, щоб переглянути або відредагувати."
        actions={<NewReportButton />}
      />

      {reports.length === 0 ? (
        <div className="border border-dashed border-border rounded-lg p-12 text-center">
          <FileText className="h-8 w-8 mx-auto text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">
            Ще немає жодного звіту для цього проєкту.
          </p>
          <div className="mt-4 inline-flex">
            <NewReportButton />
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((r) => {
            const Icon = r.kind === 'plan' ? Target : FileText
            return (
              <Link
                key={r.id}
                href={`/reports/${r.slug}`}
                className="block border rounded-lg p-4 hover:border-primary/50 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div
                    className={
                      'flex h-9 w-9 items-center justify-center shrink-0 ' +
                      (r.kind === 'plan' ? 'bg-primary text-primary-foreground' : 'bg-secondary')
                    }
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-display font-semibold tracking-tight">{r.title}</h3>
                      <span className="text-[10px] uppercase tracking-widest bg-secondary px-1.5 py-0.5 text-muted-foreground font-medium">
                        {r.periodLabel}
                      </span>
                    </div>
                    {r.subtitle ? (
                      <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{r.subtitle}</p>
                    ) : null}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
