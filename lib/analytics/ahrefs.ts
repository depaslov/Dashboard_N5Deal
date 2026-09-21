export interface AhrefsOverview {
  domainRating: number | null
  ahrefsRank: number | null
  refDomains: number | null
  refDomainsDofollow: number | null
  backlinks: number | null
  backlinksDofollow: number | null
  refIps: number | null
  organicKeywords: number | null
  organicTraffic: number | null
  organicTrafficValue: number | null
  paidKeywords: number | null
  paidTraffic: number | null
  organicPages: number | null
}

export interface AhrefsKeyword {
  keyword: string
  country: string
  position: number
  trafficShare: number
  volume: number
  cpc: number | null
  url: string
}

export interface AhrefsBacklink {
  urlFrom: string
  urlTo: string
  anchor: string
  domainRatingSource: number | null
  urlRatingSource: number | null
  isDofollow: boolean | null
  isContent: boolean | null
  firstSeen: string | null
  lastSeen: string | null
  linkType: string | null
  trafficDomain: number | null
}

export interface AhrefsRefDomain {
  domain: string
  domainRating: number | null
  refPages: number | null
  firstSeen: string | null
  linksToTarget: number | null
  trafficDomain: number | null
}

export interface AhrefsAnchor {
  anchor: string
  refDomains: number
  backlinks: number
  refPages: number
}

export interface AhrefsTopPage {
  url: string
  traffic: number
  keywords: number
  topKeyword: string | null
  topKeywordVolume: number | null
  topKeywordPosition: number | null
  value: number | null
}

export interface AhrefsSummary {
  overview: AhrefsOverview
  errors: Record<string, string>
  topKeywords: AhrefsKeyword[]
  topBacklinks: AhrefsBacklink[]
  topRefDomains: AhrefsRefDomain[]
  topAnchors: AhrefsAnchor[]
  topPages: AhrefsTopPage[]
}

export interface AhrefsQuota {
  subscription: string
  unitsLimit: number
  unitsUsage: number
  unitsRemaining: number
  resetDate: string
  keyExpires: string | null
}

const API_ROOT = 'https://api.ahrefs.com/v3'

function token(): string {
  const t = process.env.AHREFS_API_TOKEN
  if (!t) throw new Error('AHREFS_API_TOKEN env var is not set')
  return t
}

async function call<T>(path: string, params: Record<string, string | number | undefined>): Promise<T> {
  const url = new URL(`${API_ROOT}${path}`)
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v))
  }
  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token()}`,
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(45_000),
  })
  const text = await res.text()
  if (!res.ok) {
    // Try to preserve the structured Ahrefs error body for the UI.
    let body: any = null
    try {
      body = JSON.parse(text)
    } catch {}
    const msg = body?.error ?? text.slice(0, 200) ?? `${res.status}`
    throw new Error(`Ahrefs ${path} ${res.status}: ${msg}`)
  }
  return JSON.parse(text) as T
}

function isoToday(): string {
  return new Date().toISOString().slice(0, 10)
}

function safeNum(v: any): number | null {
  if (v == null) return null
  const n = typeof v === 'number' ? v : parseFloat(v)
  return Number.isFinite(n) ? n : null
}

export async function fetchAhrefsQuota(): Promise<AhrefsQuota> {
  const res = await call<any>('/subscription-info/limits-and-usage', {})
  const s = res?.limits_and_usage ?? {}
  return {
    subscription: s.subscription ?? '',
    unitsLimit: s.units_limit_workspace ?? 0,
    unitsUsage: s.units_usage_workspace ?? 0,
    unitsRemaining: Math.max(0, (s.units_limit_workspace ?? 0) - (s.units_usage_workspace ?? 0)),
    resetDate: s.usage_reset_date ?? '',
    keyExpires: s.api_key_expiration_date ?? null,
  }
}

export async function fetchAhrefsSummary(
  target: string,
  mode: 'domain' | 'subdomains' | 'exact' | 'prefix' = 'domain'
): Promise<AhrefsSummary> {
  const errors: Record<string, string> = {}
  const date = isoToday()
  const base = { target, mode }

  const tryCall = async <T>(key: string, run: () => Promise<T>): Promise<T | null> => {
    try {
      return await run()
    } catch (err: any) {
      errors[key] = String(err?.message ?? err)
      return null
    }
  }

  const [drRes, backlinksStats, metrics, keywordsRes, backlinksRes, refDomainsRes, anchorsRes, pagesRes] =
    await Promise.all([
      tryCall('domain-rating', () =>
        call<any>('/site-explorer/domain-rating', { ...base, date, output: 'json' })
      ),
      tryCall('backlinks-stats', () =>
        call<any>('/site-explorer/backlinks-stats', { ...base, date, output: 'json' })
      ),
      tryCall('metrics', () =>
        call<any>('/site-explorer/metrics', {
          ...base,
          date,
          volume_mode: 'monthly',
          output: 'json',
        })
      ),
      tryCall('organic-keywords', () =>
        call<any>('/site-explorer/organic-keywords', {
          ...base,
          date,
          country: 'us',
          limit: 50,
          order_by: 'sum_traffic:desc',
          select: 'keyword,keyword_country,best_position,volume,cpc,sum_traffic,best_position_url',
          output: 'json',
        })
      ),
      tryCall('all-backlinks', () =>
        call<any>('/site-explorer/all-backlinks', {
          ...base,
          limit: 50,
          order_by: 'domain_rating_source:desc',
          select:
            'url_from,url_to,anchor,domain_rating_source,url_rating_source,is_dofollow,is_content,first_seen,last_seen,link_type,traffic_domain',
          output: 'json',
          aggregation: '1_per_domain',
        })
      ),
      tryCall('refdomains', () =>
        call<any>('/site-explorer/refdomains', {
          ...base,
          limit: 50,
          order_by: 'domain_rating:desc',
          select: 'domain,domain_rating,first_seen,links_to_target,traffic_domain,dofollow_links',
          output: 'json',
        })
      ),
      tryCall('anchors', () =>
        call<any>('/site-explorer/anchors', {
          ...base,
          limit: 30,
          order_by: 'refdomains:desc',
          select: 'anchor,refdomains,refpages,links_to_target,dofollow_links',
          output: 'json',
        })
      ),
      tryCall('top-pages', () =>
        call<any>('/site-explorer/top-pages', {
          ...base,
          date,
          country: 'us',
          limit: 30,
          order_by: 'sum_traffic:desc',
          select: 'url,sum_traffic,keywords,top_keyword,top_keyword_volume,top_keyword_best_position,value',
          output: 'json',
        })
      ),
    ])

  const dr = drRes?.domain_rating ?? drRes?.metrics ?? drRes ?? {}
  const bs = backlinksStats ?? {}
  const m = metrics?.metrics ?? metrics ?? {}

  const overview: AhrefsOverview = {
    domainRating: safeNum(dr.domain_rating ?? dr.dr),
    ahrefsRank: safeNum(dr.ahrefs_rank),
    refDomains: safeNum(bs.live_refdomains ?? bs.refdomains ?? m.refdomains),
    refDomainsDofollow: safeNum(bs.live_refdomains_dofollow ?? bs.refdomains_dofollow),
    backlinks: safeNum(bs.live ?? bs.backlinks ?? m.backlinks),
    backlinksDofollow: safeNum(bs.live_dofollow ?? bs.dofollow),
    refIps: safeNum(bs.refips ?? bs.ref_ips),
    organicKeywords: safeNum(m.org_keywords ?? m.organic_keywords),
    organicTraffic: safeNum(m.org_traffic ?? m.organic_traffic),
    organicTrafficValue: safeNum(m.org_cost ?? m.organic_traffic_value),
    paidKeywords: safeNum(m.paid_keywords),
    paidTraffic: safeNum(m.paid_traffic),
    organicPages: safeNum(m.org_pages ?? m.organic_pages),
  }

  const topKeywords: AhrefsKeyword[] = (keywordsRes?.keywords ?? keywordsRes?.rows ?? []).map((r: any) => ({
    keyword: r.keyword ?? '',
    country: r.keyword_country ?? r.country ?? '',
    position: r.best_position ?? r.position ?? 0,
    trafficShare: r.sum_traffic ?? r.traffic ?? 0,
    volume: r.volume ?? 0,
    cpc: r.cpc ?? null,
    url: r.best_position_url ?? r.url ?? '',
  }))

  const topBacklinks: AhrefsBacklink[] = (backlinksRes?.backlinks ?? backlinksRes?.rows ?? []).map((r: any) => ({
    urlFrom: r.url_from ?? '',
    urlTo: r.url_to ?? '',
    anchor: r.anchor ?? '',
    domainRatingSource: r.domain_rating_source ?? null,
    urlRatingSource: r.url_rating_source ?? null,
    isDofollow: r.is_dofollow ?? null,
    isContent: r.is_content ?? null,
    firstSeen: r.first_seen ?? null,
    lastSeen: r.last_seen ?? null,
    linkType: r.link_type ?? null,
    trafficDomain: r.traffic_domain ?? null,
  }))

  const topRefDomains: AhrefsRefDomain[] = (refDomainsRes?.refdomains ?? refDomainsRes?.rows ?? []).map(
    (r: any) => ({
      domain: r.domain ?? '',
      domainRating: r.domain_rating ?? null,
      refPages: r.links_to_target ?? null,
      firstSeen: r.first_seen ?? null,
      linksToTarget: r.links_to_target ?? null,
      trafficDomain: r.traffic_domain ?? null,
    })
  )

  const topAnchors: AhrefsAnchor[] = (anchorsRes?.anchors ?? anchorsRes?.rows ?? []).map((r: any) => ({
    anchor: r.anchor ?? '(no anchor)',
    refDomains: r.refdomains ?? 0,
    backlinks: r.links_to_target ?? 0,
    refPages: r.refpages ?? 0,
  }))

  const topPages: AhrefsTopPage[] = (pagesRes?.pages ?? pagesRes?.rows ?? []).map((r: any) => ({
    url: r.url ?? '',
    traffic: r.sum_traffic ?? r.traffic ?? 0,
    keywords: r.keywords ?? 0,
    topKeyword: r.top_keyword ?? null,
    topKeywordVolume: r.top_keyword_volume ?? null,
    topKeywordPosition: r.top_keyword_best_position ?? null,
    value: r.value ?? null,
  }))

  return {
    overview,
    errors,
    topKeywords,
    topBacklinks,
    topRefDomains,
    topAnchors,
    topPages,
  }
}
