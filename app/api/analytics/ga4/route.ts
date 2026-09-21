import { NextResponse } from 'next/server'
import { fetchGa4Summary } from '@/lib/analytics/ga4'
import { parsePeriod, rangeForPeriod } from '@/lib/analytics/dates'
import { memoize } from '@/lib/analytics/cache'
import { requireProjectAccess, isAccessError } from '@/lib/analytics/require-access'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const ctx = await requireProjectAccess()
  if (isAccessError(ctx)) return NextResponse.json({ error: ctx.error }, { status: ctx.status })
  if (!ctx.connection?.ga4PropertyId) {
    return NextResponse.json({ error: 'GA4 not configured', configured: false }, { status: 400 })
  }

  const url = new URL(req.url)
  const period = parsePeriod(url.searchParams.get('period'))
  const range = rangeForPeriod(period)

  try {
    const data = await memoize(
      `ga4:${ctx.projectId}:${period}:${range.start}:${range.end}`,
      5 * 60 * 1000,
      () => fetchGa4Summary(ctx.connection!.ga4PropertyId!, range)
    )
    return NextResponse.json({ configured: true, period, range, data })
  } catch (err: any) {
    console.error('ga4 fetch error', err)
    return NextResponse.json({ error: err?.message ?? 'GA4 fetch failed' }, { status: 500 })
  }
}
