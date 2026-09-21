// Cross-cuts GA4 + GSC + Ahrefs data into operator-facing artifacts:
//   1. Hero metrics — the 6 numbers a marketing manager cares about most.
//   2. Landing-page performance — one row per page, joining GA4 landing metrics
//      to the GSC organic-search numbers for that URL (mirrors the "Landing
//      page + query string" view in GA4).
//   3. A prioritised list of SEO issues to fix, derived from URL Inspection
//      verdicts, sitemap warnings, and page-level GSC/GA4 signals.
//   4. Full indexation report — every inspected page grouped by status, with
//      per-page reason and fix.

export interface LandingPageRow {
  path: string                        // "/all-listing"
  fullUrl: string | null              // "https://n5deal.com/all-listing" when known via GSC
  // GSC (organic search)
  clicks: number
  impressions: number
  ctr: number
  position: number
  // GA4 (all channels — matches GA4's "Landing page" report)
  activeUsers: number
  engagedSessions: number
  engagementRate: number
  averageEngagementPerUser: number    // seconds
  eventCount: number
  // Merge diagnostics
  hasGscData: boolean
  hasGa4Data: boolean
}

export interface HeroMetric {
  key: string
  label: string
  value: number | null
  format: 'number' | 'percent' | 'decimal' | 'ratio'
  hint: string | null
  status: 'ok' | 'warn' | 'bad' | 'pending' | 'neutral'
  source: 'ahrefs' | 'gsc' | 'ga4' | 'derived'
}

export interface IndexationPageDetail {
  page: string
  status: 'indexed' | 'indexed_with_issues' | 'not_indexed' | 'blocked' | 'error' | 'unknown'
  headline: string           // "Indexed — Submitted and indexed" / "Not indexed — Crawled - currently not indexed"
  clicks: number
  impressions: number
  reason: string | null      // human-readable "why"
  fix: string | null         // "what to do"
  facts: Record<string, string | null>  // raw inspection facts to show verbatim
}

export interface IndexationReport {
  total: number
  indexed: number
  indexedWithIssues: number
  notIndexed: number
  blocked: number
  errors: number
  indexRatio: number | null
  pages: IndexationPageDetail[]
}

export type IssueSeverity = 'critical' | 'warning' | 'info'

export interface SeoIssue {
  id: string
  severity: IssueSeverity
  category: string                    // "Indexation" | "CTR" | "Rankings" | "Sitemap" | "Canonicals" | "Mobile" | "Engagement"
  title: string                       // one-line description
  fix: string                         // what to do about it
  target: string | null               // URL / query / sitemap this concerns
  impact: string | null               // "364 impressions/mo", "position 5.9"
}

// Extract the URL path from a GSC page URL (which is a full URL for URL-prefix
// properties and a full URL string for domain properties too). Falls back to
// the raw string if it's not a valid URL.
function normalizePath(url: string): string {
  if (!url) return ''
  try {
    const u = new URL(url)
    let p = u.pathname
    // Include query string when present since GSC differentiates URLs by it.
    if (u.search) p += u.search
    return p
  } catch {
    return url
  }
}

export function buildHeroMetrics(ga4: any, gsc: any, ahrefs: any, ahrefsQuotaResetIso: string | null = '2026-09-23'): HeroMetric[] {
  const ga4Ok = ga4 && !ga4.__error
  const gscOk = gsc && !gsc.__error
  const ahrefsOk = ahrefs && !ahrefs.__error

  const ahrefsHint = ahrefsQuotaResetIso ? `Ahrefs quota resets ${ahrefsQuotaResetIso}` : null

  // Ahrefs status — pending if endpoint errored due to quota
  const drVal = ahrefsOk ? ahrefs?.overview?.domainRating ?? null : null
  const orgTrafVal = ahrefsOk ? ahrefs?.overview?.organicTraffic ?? null : null
  const refDomsVal = ahrefsOk ? ahrefs?.overview?.refDomains ?? null : null
  const ahrefsPending =
    ahrefsOk &&
    ahrefs?.errors &&
    Object.values(ahrefs.errors).some((v: any) => /units limit reached|API units left: 0/i.test(String(v)))

  // GSC totals
  const clicks = gscOk ? gsc.totals?.clicks ?? 0 : null
  const impressions = gscOk ? gsc.totals?.impressions ?? 0 : null

  // Indexation ratio from inspections
  const inspections = gscOk ? gsc.inspections ?? [] : []
  const indexed = inspections.filter((i: any) => i.verdict === 'PASS').length
  const idxRatio = inspections.length > 0 ? indexed / inspections.length : null

  // GA4 totals
  const users = ga4Ok ? ga4.totals?.totalUsers ?? 0 : null

  return [
    {
      key: 'dr',
      label: 'Domain Rating',
      value: drVal,
      format: 'decimal',
      hint: drVal != null ? 'Ahrefs authority (0–100)' : ahrefsPending ? ahrefsHint : 'Awaiting Ahrefs',
      status: drVal != null ? (drVal >= 30 ? 'ok' : drVal >= 15 ? 'warn' : 'bad') : ahrefsPending ? 'pending' : 'neutral',
      source: 'ahrefs',
    },
    {
      key: 'org-traffic',
      label: 'Est. organic traffic',
      value: orgTrafVal,
      format: 'number',
      hint: orgTrafVal != null ? 'Ahrefs monthly estimate' : ahrefsPending ? ahrefsHint : 'Awaiting Ahrefs',
      status: orgTrafVal != null ? 'ok' : ahrefsPending ? 'pending' : 'neutral',
      source: 'ahrefs',
    },
    {
      key: 'ref-domains',
      label: 'Referring domains',
      value: refDomsVal,
      format: 'number',
      hint: refDomsVal != null ? 'Unique domains linking to you' : ahrefsPending ? ahrefsHint : 'Awaiting Ahrefs',
      status: refDomsVal != null ? 'ok' : ahrefsPending ? 'pending' : 'neutral',
      source: 'ahrefs',
    },
    {
      key: 'impressions',
      label: 'Search impressions',
      value: impressions,
      format: 'number',
      hint: 'Times you appeared in Google (period)',
      status: impressions != null && impressions > 0 ? 'ok' : 'neutral',
      source: 'gsc',
    },
    {
      key: 'clicks',
      label: 'Search clicks',
      value: clicks,
      format: 'number',
      hint: 'Actual Google clicks (period)',
      status: clicks != null && clicks > 0 ? 'ok' : 'neutral',
      source: 'gsc',
    },
    {
      key: 'index-ratio',
      label: 'Indexation rate',
      value: idxRatio,
      format: 'percent',
      hint: idxRatio != null ? `${indexed}/${inspections.length} top pages passing` : 'No inspection data',
      status:
        idxRatio == null
          ? 'neutral'
          : idxRatio >= 0.9
          ? 'ok'
          : idxRatio >= 0.7
          ? 'warn'
          : 'bad',
      source: 'derived',
    },
  ]
}

/**
 * Build a per-page indexation report from URL Inspection results.
 * Groups pages by status (indexed, indexed-with-issues, not-indexed, blocked,
 * error) with a plain-English reason and a fix for the operator.
 */
export function buildIndexationReport(gsc: any): IndexationReport {
  if (!gsc || gsc.__error) {
    return { total: 0, indexed: 0, indexedWithIssues: 0, notIndexed: 0, blocked: 0, errors: 0, indexRatio: null, pages: [] }
  }

  const sitemapPathsForPage = new Map<string, string[]>()
  const inspections = gsc.inspections ?? []

  const pages: IndexationPageDetail[] = inspections.map((i: any) => {
    const facts: Record<string, string | null> = {
      Verdict: i.verdict ?? null,
      'Coverage state': i.coverageState ?? null,
      'Indexing state': i.indexingState ?? null,
      'robots.txt': i.robotsTxtState ?? null,
      'Page fetch': i.pageFetchState ?? null,
      'Crawled as': i.crawledAs ?? null,
      'Last crawl': i.lastCrawlTime ? new Date(i.lastCrawlTime).toISOString().slice(0, 10) : null,
      'Google canonical': i.googleCanonical ?? null,
      'User canonical': i.userCanonical ?? null,
      Mobile: i.mobileVerdict ?? null,
      AMP: i.ampVerdict ?? null,
      'Rich results': i.richResultsVerdict ?? null,
      'In sitemap': (i.sitemap ?? []).length > 0 ? (i.sitemap ?? []).join(', ') : 'Not in sitemap',
      'Referring URLs': (i.referringUrls ?? []).length > 0 ? String((i.referringUrls ?? []).length) : '0',
    }

    let status: IndexationPageDetail['status'] = 'unknown'
    let headline = ''
    let reason: string | null = null
    let fix: string | null = null

    if (i.error) {
      status = 'error'
      headline = 'Inspection failed'
      reason = i.error
      fix = /permission|403|forbidden/i.test(i.error)
        ? 'Service account needs Owner or Full user access in GSC → Settings → Users to run URL Inspection.'
        : 'Retry the sync; if it persists, try inspecting the URL manually in GSC.'
    } else if (i.robotsTxtState === 'DISALLOWED') {
      status = 'blocked'
      headline = 'Blocked by robots.txt'
      reason = 'Your /robots.txt has a Disallow rule matching this URL, so Googlebot cannot crawl it.'
      fix = 'Remove or narrow the matching Disallow line in /robots.txt if this page should rank. Otherwise leave it.'
    } else if (i.indexingState === 'BLOCKED_BY_META_TAG') {
      status = 'blocked'
      headline = 'Blocked by noindex meta tag'
      reason = 'The page HTML contains <meta name="robots" content="noindex">.'
      fix = 'Remove the noindex meta tag from this page, then request re-indexing in GSC.'
    } else if (i.indexingState === 'BLOCKED_BY_HTTP_HEADER') {
      status = 'blocked'
      headline = 'Blocked by X-Robots-Tag'
      reason = 'The response returns an `X-Robots-Tag: noindex` HTTP header.'
      fix = 'Remove the X-Robots-Tag noindex header (in server config / middleware / edge function) for this URL.'
    } else if (i.pageFetchState && i.pageFetchState !== 'SUCCESSFUL' && i.pageFetchState !== 'PAGE_FETCH_STATE_UNSPECIFIED') {
      status = 'error'
      headline = `Page fetch failed (${i.pageFetchState})`
      reason = 'Googlebot could not fetch this URL — the fetch returned a non-2xx status, redirect loop, or timeout.'
      fix = 'Check server logs and CDN for Googlebot user-agents. Ensure the URL returns 200 in <5s with no redirect chains.'
    } else if (i.verdict === 'PASS' && /submitted and indexed|indexed, not submitted/i.test(i.coverageState ?? '')) {
      status = 'indexed'
      headline = `Indexed — ${i.coverageState}`
      reason = null
      fix = null
    } else if (i.verdict === 'PASS') {
      status = 'indexed'
      headline = `Indexed — ${i.coverageState ?? 'PASS'}`
      reason = null
      fix = null
    } else if (i.verdict === 'PARTIAL') {
      status = 'indexed_with_issues'
      headline = `Indexed with issues — ${i.coverageState ?? 'PARTIAL'}`
      reason = 'Page is in the index but has a problem: possibly duplicate content, canonical mismatch, or resource fetch issues.'
      fix = 'Open GSC → URL Inspection for this page for the exact reason. Common fixes: pick a canonical, fix duplicate meta, ensure JS/CSS/images are fetchable.'
    } else if (i.verdict === 'FAIL' || i.verdict === 'NEUTRAL' || (i.coverageState && /not indexed/i.test(i.coverageState))) {
      status = 'not_indexed'
      const cov = i.coverageState ?? 'Not indexed'
      headline = `Not indexed — ${cov}`
      if (/crawled - currently not indexed/i.test(cov)) {
        reason =
          'Google crawled the page but chose not to index it — usually because content quality is thin, similar to other pages, or the page targets a low-demand query.'
        fix =
          'Beef up the content: add original insight, statistics, structured data. Add strong internal links from your top pages. Then request indexing.'
      } else if (/discovered - currently not indexed/i.test(cov)) {
        reason =
          'Google discovered the URL (via sitemap or internal link) but hasn\'t crawled it yet, usually due to crawl budget or perceived low priority.'
        fix =
          'Add internal links to this page from high-authority pages on your site. Ensure sitemap lastmod is recent. If really important, request indexing manually.'
      } else if (/duplicate/i.test(cov)) {
        reason = `Google sees this as duplicate content. It picked "${i.googleCanonical ?? 'a different URL'}" as the canonical instead.`
        fix = 'Either accept Google\'s canonical (add rel=canonical pointing to it), or de-duplicate the content by making it substantially different.'
      } else if (/soft 404/i.test(cov)) {
        reason = 'Google decided this is a "soft 404" — page returned 200 but looks empty/error-like to Google.'
        fix = 'Add real content (not just "no results"), or actually return 404 status when there are no results.'
      } else if (/redirect/i.test(cov)) {
        reason = 'The URL redirects — Google indexes the redirect target instead.'
        fix = 'This is usually fine. If you want the source URL indexed, remove the redirect.'
      } else if (/noindex/i.test(cov)) {
        reason = 'The page has a noindex directive (meta tag or HTTP header) instructing Google not to index it.'
        fix = 'Remove the noindex directive if you want this page in Google.'
      } else if (/excluded by ‘noindex’ tag/i.test(cov)) {
        reason = 'Explicit noindex tag on the page.'
        fix = 'Remove noindex.'
      } else if (/not found \(404\)/i.test(cov)) {
        reason = 'URL returns 404 — Google won\'t index missing pages.'
        fix = 'Either restore the page, redirect it, or accept the 404.'
      } else {
        reason = `Google's coverage state is "${cov}".`
        fix = 'Open GSC → URL Inspection → View crawled page for detailed reason and click Request Indexing after fixing.'
      }
    } else {
      status = 'unknown'
      headline = `Status: ${i.verdict ?? 'unknown'} — ${i.coverageState ?? '—'}`
      reason = null
      fix = 'Open the URL in GSC URL Inspection for full details.'
    }

    // Cross-reference sitemap for this page
    if ((i.sitemap ?? []).length > 0) {
      sitemapPathsForPage.set(i.page, i.sitemap)
    } else if (status === 'not_indexed' || status === 'indexed_with_issues') {
      // Explicit warning: not in sitemap AND not indexed
      if (reason) {
        reason += ' The page is also not in any submitted sitemap — this makes discovery harder.'
      }
    }

    return {
      page: i.page,
      status,
      headline,
      clicks: i.clicks ?? 0,
      impressions: i.impressions ?? 0,
      reason,
      fix,
      facts,
    }
  })

  const indexed = pages.filter((p) => p.status === 'indexed').length
  const indexedWithIssues = pages.filter((p) => p.status === 'indexed_with_issues').length
  const notIndexed = pages.filter((p) => p.status === 'not_indexed').length
  const blocked = pages.filter((p) => p.status === 'blocked').length
  const errors = pages.filter((p) => p.status === 'error').length

  // Sort: problems first, then by impressions desc
  const rank: Record<IndexationPageDetail['status'], number> = {
    error: 0,
    blocked: 1,
    not_indexed: 2,
    indexed_with_issues: 3,
    indexed: 4,
    unknown: 5,
  }
  pages.sort((a, b) => rank[a.status] - rank[b.status] || b.impressions - a.impressions)

  return {
    total: pages.length,
    indexed,
    indexedWithIssues,
    notIndexed,
    blocked,
    errors,
    indexRatio: pages.length > 0 ? indexed / pages.length : null,
    pages,
  }
}

export function buildLandingPageReport(ga4: any, gsc: any): LandingPageRow[] {
  const gscByPath = new Map<string, any>()
  for (const p of gsc?.topPages ?? []) {
    const path = normalizePath(p.key)
    if (!path) continue
    // GSC returns one row per URL — no aggregation needed
    gscByPath.set(path, { ...p, path })
  }

  const ga4ByPath = new Map<string, any>()
  for (const l of ga4?.topLandingPages ?? []) {
    // GA4 landingPage already comes as path, but strip query so we can match
    // GSC pages too (GSC may or may not include query; store both).
    const path = l.key || '/'
    ga4ByPath.set(path, l)
  }

  // Union of both sources — a page could have GSC clicks but 0 landing sessions
  // (users didn't land there) or vice versa.
  const allPaths = new Set<string>()
  gscByPath.forEach((_, k) => allPaths.add(k))
  ga4ByPath.forEach((_, k) => allPaths.add(k))
  // Also try stripping query strings from GA4 paths to match GSC (which usually strips them)
  const paths = Array.from(allPaths)

  const rows: LandingPageRow[] = paths.map((path) => {
    const g = gscByPath.get(path) ?? gscByPath.get(path.split('?')[0])
    const a = ga4ByPath.get(path) ?? ga4ByPath.get(path.split('?')[0])
    return {
      path,
      fullUrl: g ? g.key : null,
      clicks: g?.clicks ?? 0,
      impressions: g?.impressions ?? 0,
      ctr: g?.ctr ?? 0,
      position: g?.position ?? 0,
      activeUsers: a?.activeUsers ?? 0,
      engagedSessions: a?.engagedSessions ?? 0,
      engagementRate: a?.engagementRate ?? 0,
      averageEngagementPerUser: a?.averageEngagementPerUser ?? 0,
      eventCount: a?.eventCount ?? 0,
      hasGscData: !!g,
      hasGa4Data: !!a,
    }
  })

  // Sort by impressions desc, then by active users desc — matches the GA4 view
  // where "Landing page + query string" defaults to descending organic clicks
  // but we care more about opportunity size.
  rows.sort((x, y) => y.impressions - x.impressions || y.activeUsers - x.activeUsers)
  return rows
}

export function buildSeoIssues(ga4: any, gsc: any): SeoIssue[] {
  const issues: SeoIssue[] = []
  if (!gsc || gsc.__error) return issues

  const push = (i: SeoIssue) => issues.push(i)

  /* ------------- Sitemaps ------------- */
  for (const sm of gsc.sitemaps ?? []) {
    if ((sm.errors ?? 0) > 0) {
      push({
        id: `sitemap-err-${sm.path}`,
        severity: 'critical',
        category: 'Sitemap',
        title: `Sitemap has ${sm.errors} error(s)`,
        fix: `Open GSC → Sitemaps → ${sm.path} and inspect the errors. Common causes: invalid URLs, blocked pages, wrong lastmod dates.`,
        target: sm.path,
        impact: null,
      })
    }
    if ((sm.warnings ?? 0) > 0) {
      push({
        id: `sitemap-warn-${sm.path}`,
        severity: 'warning',
        category: 'Sitemap',
        title: `Sitemap has ${sm.warnings} warning(s)`,
        fix: 'Warnings usually mean noindex-tagged or blocked pages are still in the sitemap. Remove them or drop the noindex tag.',
        target: sm.path,
        impact: null,
      })
    }
    const daysSinceDownload = sm.lastDownloaded
      ? Math.round((Date.now() - new Date(sm.lastDownloaded).getTime()) / (86400 * 1000))
      : null
    if (daysSinceDownload != null && daysSinceDownload > 14) {
      push({
        id: `sitemap-stale-${sm.path}`,
        severity: 'warning',
        category: 'Sitemap',
        title: `Sitemap not re-crawled by Google for ${daysSinceDownload} days`,
        fix: 'Ping the sitemap by resubmitting in GSC. If pings still don\'t trigger, check the site\'s robots.txt and that the sitemap responds with HTTP 200.',
        target: sm.path,
        impact: null,
      })
    }
  }

  /* ------------- URL Inspection verdicts ------------- */
  for (const i of gsc.inspections ?? []) {
    if (!i.page) continue
    const impact = i.impressions > 0 ? `${i.impressions.toLocaleString()} impr · ${i.clicks} clicks` : null

    if (i.verdict === 'FAIL' || (i.coverageState && /not indexed/i.test(i.coverageState))) {
      push({
        id: `idx-fail-${i.page}`,
        severity: 'critical',
        category: 'Indexation',
        title: `Page not indexed — ${i.coverageState ?? 'FAIL'}`,
        fix: i.indexingState === 'BLOCKED_BY_META_TAG'
          ? 'Remove the noindex meta tag from this page, then request re-indexing in GSC.'
          : i.indexingState === 'BLOCKED_BY_HTTP_HEADER'
          ? 'Remove the X-Robots-Tag: noindex HTTP header from this URL, then request re-indexing.'
          : i.robotsTxtState === 'DISALLOWED'
          ? 'robots.txt is blocking crawl of this URL. Unblock it in robots.txt if the page should be indexed.'
          : 'Open GSC → URL Inspection → Request Indexing. Also verify the page returns 200 with no noindex tag.',
        target: i.page,
        impact,
      })
    } else if (i.verdict === 'PARTIAL') {
      push({
        id: `idx-partial-${i.page}`,
        severity: 'warning',
        category: 'Indexation',
        title: `Page has partial indexation status (${i.coverageState ?? 'PARTIAL'})`,
        fix: 'Usually means the page is indexed but a resource (image, script, canonical) has issues. Check GSC URL Inspection for the specific problem.',
        target: i.page,
        impact,
      })
    }

    if (i.robotsTxtState === 'DISALLOWED' && i.verdict !== 'FAIL') {
      push({
        id: `robots-${i.page}`,
        severity: 'critical',
        category: 'Indexation',
        title: 'robots.txt disallows crawling this page',
        fix: 'If this page should rank, remove or narrow the Disallow rule in /robots.txt.',
        target: i.page,
        impact,
      })
    }

    if (i.userCanonical && i.googleCanonical && i.userCanonical !== i.googleCanonical) {
      push({
        id: `canon-${i.page}`,
        severity: 'warning',
        category: 'Canonicals',
        title: 'Google picked a different canonical than the page declares',
        fix: `You declared \`${i.userCanonical}\` but Google picked \`${i.googleCanonical}\`. Usually caused by duplicate content, weak internal links, or contradictory hreflang. Consolidate or fix the canonical.`,
        target: i.page,
        impact,
      })
    }

    if (i.mobileVerdict && i.mobileVerdict !== 'PASS' && i.mobileVerdict !== 'VERDICT_UNSPECIFIED') {
      push({
        id: `mobile-${i.page}`,
        severity: 'warning',
        category: 'Mobile',
        title: `Mobile usability issue: ${i.mobileVerdict}`,
        fix: 'Open GSC → URL Inspection → Test Live URL → Mobile usability for the exact issue (text too small, tap targets too close, viewport not set, etc.).',
        target: i.page,
        impact,
      })
    }

    if (i.pageFetchState && i.pageFetchState !== 'SUCCESSFUL' && i.pageFetchState !== 'PAGE_FETCH_STATE_UNSPECIFIED') {
      push({
        id: `fetch-${i.page}`,
        severity: 'critical',
        category: 'Indexation',
        title: `Googlebot could not fetch this page (${i.pageFetchState})`,
        fix: 'The page returned a non-2xx status or timed out. Check server logs and hosting for uptime/redirect chains/slow response for Googlebot.',
        target: i.page,
        impact,
      })
    }
  }

  /* ------------- GSC page-level opportunities ------------- */
  for (const p of gsc.topPages ?? []) {
    if (!p.key) continue
    const clicks = p.clicks ?? 0
    const impressions = p.impressions ?? 0
    const ctr = p.ctr ?? 0
    const pos = p.position ?? 0

    // Position 4-10 (page 1) with weak CTR — meta title/description gap
    if (pos >= 4 && pos <= 10 && impressions >= 100 && ctr < 0.02) {
      push({
        id: `low-ctr-${p.key}`,
        severity: 'warning',
        category: 'CTR',
        title: `Page 1 ranking but CTR is only ${(ctr * 100).toFixed(1)}%`,
        fix: 'Rewrite the meta title and description to be more compelling. Add the target keyword near the start, include the year/benefit/differentiator.',
        target: p.key,
        impact: `pos ${pos.toFixed(1)} · ${impressions.toLocaleString()} impr · ${clicks} clicks`,
      })
    }

    // Position 11-20 with real volume — quick rank wins
    if (pos > 10 && pos <= 20 && impressions >= 200) {
      push({
        id: `page2-${p.key}`,
        severity: 'info',
        category: 'Rankings',
        title: `Page 2 ranking (pos ${pos.toFixed(1)}) with ${impressions.toLocaleString()} impressions`,
        fix: 'Add depth: refresh content with LSI keywords, add FAQ schema, improve internal links from top pages, add fresh statistics. Target: crack top 10.',
        target: p.key,
        impact: `pos ${pos.toFixed(1)} · ${impressions.toLocaleString()} impr`,
      })
    }

    // Position 21-50 with volume — content-gap / topical authority
    if (pos > 20 && pos <= 50 && impressions >= 500) {
      push({
        id: `page3-${p.key}`,
        severity: 'info',
        category: 'Rankings',
        title: `Deep-page ranking (pos ${pos.toFixed(0)}) with high impressions`,
        fix: 'Consider expanding this page into a hub with sub-topics, or add clustered supporting content around it. Google is showing it — you need one more push.',
        target: p.key,
        impact: `pos ${pos.toFixed(1)} · ${impressions.toLocaleString()} impr`,
      })
    }
  }

  /* ------------- GSC query-level: high-impression zero-click ------------- */
  for (const q of gsc.topQueries ?? []) {
    if (!q.key) continue
    if ((q.impressions ?? 0) >= 500 && (q.clicks ?? 0) === 0 && (q.position ?? 100) <= 30) {
      push({
        id: `zero-click-${q.key}`,
        severity: 'warning',
        category: 'CTR',
        title: `Query "${q.key}" has ${q.impressions.toLocaleString()} impressions but 0 clicks`,
        fix: 'Either the SERP shows a rich answer (featured snippet / AI Overview) stealing clicks, or your title doesn\'t match the intent. Optimize title/description or target the featured snippet format.',
        target: q.key,
        impact: `pos ${q.position.toFixed(1)}`,
      })
    }
  }

  /* ------------- GA4 signals ------------- */
  for (const p of ga4?.topLandingPages ?? []) {
    if (!p.key) continue
    if ((p.bounceRate ?? 0) > 0.85 && (p.sessions ?? 0) >= 50) {
      push({
        id: `bounce-${p.key}`,
        severity: 'warning',
        category: 'Engagement',
        title: `Landing page bounces at ${((p.bounceRate ?? 0) * 100).toFixed(0)}%`,
        fix: 'High bounce on a landing page usually means intent mismatch, slow load, or weak above-the-fold. Check CWV, add a clear CTA, and match the meta title to visible content.',
        target: p.key,
        impact: `${p.sessions} sessions`,
      })
    }
  }

  /* ------------- Deduplicate and rank ------------- */
  const seen = new Set<string>()
  const unique = issues.filter((i) => {
    if (seen.has(i.id)) return false
    seen.add(i.id)
    return true
  })
  const rank: Record<IssueSeverity, number> = { critical: 0, warning: 1, info: 2 }
  unique.sort((a, b) => rank[a.severity] - rank[b.severity])
  return unique
}
