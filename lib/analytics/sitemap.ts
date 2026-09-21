// Fetch and flatten a sitemap.xml, following <sitemap> children when it's an
// index. We deliberately don't reach for an XML parser — sitemaps are simple
// enough that regex on <loc> is faster and dependency-free.

const MAX_SITEMAP_DEPTH = 3
const MAX_URLS = 2000

export async function fetchSitemapUrls(sitemapUrl: string): Promise<{ urls: string[]; sourceMap: Record<string, string> }> {
  const urls: string[] = []
  const sourceMap: Record<string, string> = {} // url -> sitemap it came from
  const seen = new Set<string>()

  async function walk(url: string, depth: number) {
    if (depth > MAX_SITEMAP_DEPTH) return
    if (urls.length >= MAX_URLS) return

    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (analytics-dashboard/1.0)' },
      signal: AbortSignal.timeout(15_000),
    }).catch(() => null)
    if (!res || !res.ok) return
    const xml = await res.text()

    const isSitemapIndex = /<sitemapindex/i.test(xml)
    const locs = extractLocs(xml)

    if (isSitemapIndex) {
      for (const child of locs) {
        if (urls.length >= MAX_URLS) break
        await walk(child, depth + 1)
      }
    } else {
      for (const u of locs) {
        if (seen.has(u)) continue
        seen.add(u)
        urls.push(u)
        sourceMap[u] = url
        if (urls.length >= MAX_URLS) break
      }
    }
  }

  await walk(sitemapUrl, 0)
  return { urls, sourceMap }
}

function extractLocs(xml: string): string[] {
  const out: string[] = []
  const re = /<loc>\s*([^<\s][^<]*?)\s*<\/loc>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(xml)) !== null) {
    out.push(m[1].trim())
  }
  return out
}

// GSC sites come in two forms: "https://n5deal.com/" (URL-prefix) or
// "sc-domain:n5deal.com" (domain property). Derive the canonical sitemap URL
// from either.
export function deriveSitemapUrl(gscSiteUrl: string): string {
  if (gscSiteUrl.startsWith('sc-domain:')) {
    return `https://${gscSiteUrl.slice('sc-domain:'.length)}/sitemap.xml`
  }
  if (gscSiteUrl.endsWith('/')) return `${gscSiteUrl}sitemap.xml`
  return `${gscSiteUrl}/sitemap.xml`
}
