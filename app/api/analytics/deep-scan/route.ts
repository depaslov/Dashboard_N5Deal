import { NextResponse } from 'next/server'
import { requireProjectAccess, isAccessError } from '@/lib/analytics/require-access'
import { fetchSitemapUrls, deriveSitemapUrl } from '@/lib/analytics/sitemap'
import { runDeepIndexationScan } from '@/lib/analytics/deep-indexation'
import { memoize } from '@/lib/analytics/cache'

export const dynamic = 'force-dynamic'
// Full sitemap scan can inspect up to 300 URLs — needs more than the 10s
// default Vercel timeout.
export const maxDuration = 300

// Returns the full sitemap-based indexation report. Cached for 12 hours because
// URL Inspection API has a 2000/day per property quota — running it too often
// exhausts the quota fast.
export async function GET(_req: Request) {
  const ctx = await requireProjectAccess()
  if (isAccessError(ctx)) return NextResponse.json({ error: ctx.error }, { status: ctx.status })
  if (!ctx.connection?.gscSiteUrl) {
    return NextResponse.json({ error: 'GSC not configured', configured: false }, { status: 400 })
  }

  const siteUrl = ctx.connection.gscSiteUrl
  const cacheKey = `deep-scan:${ctx.projectId}:${siteUrl}`

  try {
    const data = await memoize(cacheKey, 12 * 60 * 60 * 1000, async () => {
      const sitemapUrl = deriveSitemapUrl(siteUrl)
      const { urls: sitemapUrls } = await fetchSitemapUrls(sitemapUrl)
      const sitemapSet = new Set(sitemapUrls)

      // Priority-ordered list: sitemap URLs come first (site's declared canon),
      // then anything else GSC or GA4 recently saw traffic to.
      const candidates = Array.from(new Set([...sitemapUrls]))

      const report = await runDeepIndexationScan(siteUrl, candidates, sitemapSet)
      return { sitemapUrl, ...report }
    })
    return NextResponse.json({ configured: true, data })
  } catch (err: any) {
    console.error('deep-scan error', err)
    return NextResponse.json({ error: err?.message ?? 'Deep scan failed' }, { status: 500 })
  }
}
