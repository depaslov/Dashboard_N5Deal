import { NextResponse } from 'next/server'
import { fetchGscSummary } from '@/lib/analytics/gsc'
import { parsePeriod, rangeForPeriod } from '@/lib/analytics/dates'
import { memoize } from '@/lib/analytics/cache'
import { requireProjectAccess, isAccessError } from '@/lib/analytics/require-access'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const ctx = await requireProjectAccess()
  if (isAccessError(ctx)) return NextResponse.json({ error: ctx.error }, { status: ctx.status })
  if (!ctx.connection?.gscSiteUrl) {
    return NextResponse.json({ error: 'GSC not configured', configured: false }, { status: 400 })
  }

  const url = new URL(req.url)
  const period = parsePeriod(url.searchParams.get('period'))
  const range = rangeForPeriod(period)

  try {
    const data = await memoize(
      `gsc:${ctx.projectId}:${period}:${range.start}:${range.end}`,
      5 * 60 * 1000,
      () => fetchGscSummary(ctx.connection!.gscSiteUrl!, range)
    )
    return NextResponse.json({ configured: true, period, range, data })
  } catch (err: any) {
    console.error('gsc fetch error', err)
    return NextResponse.json({ error: err?.message ?? 'GSC fetch failed' }, { status: 500 })
  }
}
