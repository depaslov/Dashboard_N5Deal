import { NextResponse } from 'next/server'
import { fetchGa4Summary } from '@/lib/analytics/ga4'
import { fetchGscSummary } from '@/lib/analytics/gsc'
import { fetchAhrefsSummary } from '@/lib/analytics/ahrefs'
import { parsePeriod, rangeForPeriod } from '@/lib/analytics/dates'
import { memoize } from '@/lib/analytics/cache'
import { requireProjectAccess, isAccessError } from '@/lib/analytics/require-access'
import { buildLandingPageReport, buildSeoIssues, buildHeroMetrics, buildIndexationReport } from '@/lib/analytics/seo-report'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const ctx = await requireProjectAccess()
  if (isAccessError(ctx)) return NextResponse.json({ error: ctx.error }, { status: ctx.status })

  const url = new URL(req.url)
  const period = parsePeriod(url.searchParams.get('period'))
  const range = rangeForPeriod(period)
  const conn = ctx.connection

  const [ga4, gsc, ahrefs] = await Promise.all([
    conn?.ga4PropertyId
      ? memoize(`ga4:${ctx.projectId}:${period}:${range.start}:${range.end}`, 5 * 60 * 1000, () =>
          fetchGa4Summary(conn.ga4PropertyId!, range)
        ).catch((err) => ({ __error: String(err?.message ?? err) }))
      : Promise.resolve(null),
    conn?.gscSiteUrl
      ? memoize(`gsc:${ctx.projectId}:${period}:${range.start}:${range.end}`, 30 * 60 * 1000, () =>
          fetchGscSummary(conn.gscSiteUrl!, range)
        ).catch((err) => ({ __error: String(err?.message ?? err) }))
      : Promise.resolve(null),
    conn?.ahrefsTarget
      ? memoize(
          `ahrefs:${ctx.projectId}:${conn.ahrefsMode}:${conn.ahrefsTarget}`,
          6 * 60 * 60 * 1000,
          () => fetchAhrefsSummary(conn.ahrefsTarget!, (conn.ahrefsMode as any) ?? 'domain')
        ).catch((err) => ({ __error: String(err?.message ?? err) }))
      : Promise.resolve(null),
  ])

  // Cross-cut the two Google datasets into two operator-facing artifacts:
  //   1. Merged landing-page performance (like the GA4 "Landing page + query string" view)
  //   2. Prioritised SEO issues to fix, in red/amber/blue
  const ga4HasData = ga4 && !(ga4 as any).__error
  const gscHasData = gsc && !(gsc as any).__error
  const landingPageReport = ga4HasData && gscHasData ? buildLandingPageReport(ga4, gsc) : []
  const seoIssues = gscHasData ? buildSeoIssues(ga4HasData ? ga4 : null, gsc) : []
  const heroMetrics = buildHeroMetrics(
    ga4HasData ? ga4 : null,
    gscHasData ? gsc : null,
    ahrefs && !(ahrefs as any).__error ? ahrefs : null
  )
  const indexationReport = gscHasData ? buildIndexationReport(gsc) : null

  return NextResponse.json({
    period,
    range,
    connection: {
      ga4Configured: !!conn?.ga4PropertyId,
      gscConfigured: !!conn?.gscSiteUrl,
      ahrefsConfigured: !!conn?.ahrefsTarget,
    },
    ga4,
    gsc,
    ahrefs,
    heroMetrics,
    landingPageReport,
    seoIssues,
    indexationReport,
  })
}
