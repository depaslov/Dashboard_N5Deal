import Link from 'next/link'
import { PageHeader } from '@/components/app/page-header'
import { FileText, Calendar, Target } from 'lucide-react'

export const dynamic = 'force-dynamic'

// Monthly operational recap reports — what was done, pages written, link
// building progress, dashboard work. Separate from Marketing Analytics
// reports (impressions / clicks / engagement) that live under Marketing OS.
//
// Add a new month by:
//   1. Creating app/(app)/reports/YYYY-MM/page.tsx
//   2. Appending an entry to MONTHLY_REPORTS below
const MONTHLY_REPORTS: Array<{
  slug: string
  title: string
  subtitle: string
  period: string
  href: string
  kind: 'plan' | 'recap'
}> = [
  {
    slug: '2026-07-plan',
    title: 'N5Deal — План на липень 2026',
    subtitle:
      '66 матеріалів по каналах: 25 articles + 10 Medium (3 carry-over) + 6 market news + 10 profiles + 12 Reddit + 3 paid outreach. Тижнева розбивка + денний ритм W1-W2.',
    period: 'Липень 2026 (план)',
    href: '/reports/2026-07-plan',
    kind: 'plan',
  },
  {
    slug: '2026-06',
    title: 'N5Deal — Звіт за червень 2026',
    subtitle:
      '13 статей у блог (fintech licensing / M&A advisory / regulatory) + 6 Medium (WEB 2.0). Секція GA4-аналітики. Press Releases + Glossary + Deployment infra на дешборді. LB: 7 профілів, 7 Reddit (забанили), 6 Medium, перша закупка PRNews.io.',
    period: 'Червень 2026',
    href: '/reports/2026-06',
    kind: 'recap',
  },
]

export default function ReportsIndexPage() {
  return (
    <div className="max-w-[1100px] mx-auto">
      <PageHeader
        title="Reports"
        description="Місячні звіти по контенту, лінкбілдингу та роботі над дашбордом."
      />
      <div className="space-y-3">
        {MONTHLY_REPORTS.map((r) => {
          // Plans get a Target icon + primary tint so they visually stand
          // apart from retrospective recaps in the same list.
          const Icon = r.kind === 'plan' ? Target : FileText
          return (
            <Link
              key={r.slug}
              href={r.href}
              className="block border rounded-lg p-4 hover:border-primary/50 hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className="rounded-md bg-primary/10 text-primary p-2 mt-0.5">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold">{r.title}</div>
                  <div className="text-sm text-muted-foreground mt-1">{r.subtitle}</div>
                  <div className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {r.period}
                  </div>
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
