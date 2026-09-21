import { google } from 'googleapis'
import { getJwtClient } from './google-auth'

export interface GscDailyRow {
  date: string
  clicks: number
  impressions: number
  ctr: number
  position: number
}

export interface GscTopRow {
  key: string
  clicks: number
  impressions: number
  ctr: number
  position: number
}

export interface GscTopRowSecondary {
  key: string
  secondary: string
  clicks: number
  impressions: number
  ctr: number
  position: number
}

export interface GscSitemap {
  path: string
  lastSubmitted: string | null
  lastDownloaded: string | null
  errors: number
  warnings: number
  isPending: boolean
  isSitemapsIndex: boolean
  type: string | null
  contents: { type: string | null; submitted: number; indexed: number }[]
}

export interface GscInspection {
  page: string
  clicks: number
  impressions: number
  verdict: string | null
  coverageState: string | null
  robotsTxtState: string | null
  indexingState: string | null
  pageFetchState: string | null
  lastCrawlTime: string | null
  crawledAs: string | null
  googleCanonical: string | null
  userCanonical: string | null
  referringUrls: string[]
  sitemap: string[]
  mobileVerdict: string | null
  ampVerdict: string | null
  richResultsVerdict: string | null
  error: string | null
}

export interface GscSummary {
  totals: {
    clicks: number
    impressions: number
    ctr: number
    position: number
  }
  daily: GscDailyRow[]
  topQueries: GscTopRow[]
  topPages: GscTopRow[]
  topCountries: GscTopRow[]
  topDevices: GscTopRow[]
  topSearchAppearance: GscTopRow[]
  queriesByPage: GscTopRowSecondary[]
  countriesByPage: GscTopRowSecondary[]
  sitemaps: GscSitemap[]
  inspections: GscInspection[]
  inspectionsError: string | null
}

const READ_SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly'
const FULL_SCOPE = 'https://www.googleapis.com/auth/webmasters'

function searchconsole(scope: string = READ_SCOPE) {
  const auth = getJwtClient([scope])
  return google.searchconsole({ version: 'v1', auth })
}

async function query(
  siteUrl: string,
  range: { start: string; end: string },
  dims: string[],
  rowLimit = 25,
  type: 'web' | 'discover' | 'googleNews' | 'image' | 'video' = 'web'
) {
  const sc = searchconsole()
  const res = await sc.searchanalytics.query({
    siteUrl,
    requestBody: {
      startDate: range.start,
      endDate: range.end,
      dimensions: dims,
      rowLimit,
      dataState: 'final',
      type,
    },
  })
  return res.data.rows ?? []
}

function num(v: number | null | undefined) {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0
}

const mapPrimary = (rows: any[]): GscTopRow[] =>
  rows.map((r) => ({
    key: r.keys?.[0] ?? '',
    clicks: num(r.clicks),
    impressions: num(r.impressions),
    ctr: num(r.ctr),
    position: num(r.position),
  }))

const mapSecondary = (rows: any[]): GscTopRowSecondary[] =>
  rows.map((r) => ({
    key: r.keys?.[0] ?? '',
    secondary: r.keys?.[1] ?? '',
    clicks: num(r.clicks),
    impressions: num(r.impressions),
    ctr: num(r.ctr),
    position: num(r.position),
  }))

export async function fetchGscSummary(siteUrl: string, range: { start: string; end: string }): Promise<GscSummary> {
  const [
    daily,
    topQueries,
    topPages,
    topCountries,
    topDevices,
    topAppearance,
    queriesByPage,
    countriesByPage,
    sitemaps,
  ] = await Promise.all([
    query(siteUrl, range, ['date'], 1000).catch(() => []),
    query(siteUrl, range, ['query'], 100).catch(() => []),
    query(siteUrl, range, ['page'], 100).catch(() => []),
    query(siteUrl, range, ['country'], 40).catch(() => []),
    query(siteUrl, range, ['device'], 10).catch(() => []),
    query(siteUrl, range, ['searchAppearance'], 25).catch(() => []),
    query(siteUrl, range, ['page', 'query'], 100).catch(() => []),
    query(siteUrl, range, ['page', 'country'], 100).catch(() => []),
    listSitemaps(siteUrl).catch(() => []),
  ])

  const dailyRows: GscDailyRow[] = daily.map((r: any) => ({
    date: r.keys?.[0] ?? '',
    clicks: num(r.clicks),
    impressions: num(r.impressions),
    ctr: num(r.ctr),
    position: num(r.position),
  }))

  const clicks = dailyRows.reduce((a, r) => a + r.clicks, 0)
  const impressions = dailyRows.reduce((a, r) => a + r.impressions, 0)
  const totals = {
    clicks,
    impressions,
    ctr: impressions > 0 ? clicks / impressions : 0,
    position:
      dailyRows.length > 0
        ? dailyRows.reduce((a, r) => a + r.position * r.impressions, 0) / (impressions || 1)
        : 0,
  }

  const topPagesMapped = mapPrimary(topPages)

  // Inspect the top pages for indexation status. URL Inspection API allows
  // ~2000 calls per day per property and 600/minute — we inspect the top 30
  // by impressions in parallel (each call is slow individually, but Google
  // handles the concurrency fine).
  const { inspections, inspectionsError } = await inspectTopPages(
    siteUrl,
    topPagesMapped.slice(0, 30)
  )

  return {
    totals,
    daily: dailyRows,
    topQueries: mapPrimary(topQueries),
    topPages: topPagesMapped,
    topCountries: mapPrimary(topCountries),
    topDevices: mapPrimary(topDevices),
    topSearchAppearance: mapPrimary(topAppearance),
    queriesByPage: mapSecondary(queriesByPage),
    countriesByPage: mapSecondary(countriesByPage),
    sitemaps,
    inspections,
    inspectionsError,
  }
}

export async function listGscSites(): Promise<string[]> {
  const sc = searchconsole()
  const res = await sc.sites.list()
  return (res.data.siteEntry ?? []).map((s: any) => s.siteUrl).filter(Boolean)
}

async function listSitemaps(siteUrl: string): Promise<GscSitemap[]> {
  const sc = searchconsole()
  const res = await sc.sitemaps.list({ siteUrl })
  const items = res.data.sitemap ?? []
  return items.map((s: any) => ({
    path: s.path ?? '',
    lastSubmitted: s.lastSubmitted ?? null,
    lastDownloaded: s.lastDownloaded ?? null,
    errors: Number(s.errors ?? 0),
    warnings: Number(s.warnings ?? 0),
    isPending: !!s.isPending,
    isSitemapsIndex: !!s.isSitemapsIndex,
    type: s.type ?? null,
    contents: (s.contents ?? []).map((c: any) => ({
      type: c.type ?? null,
      submitted: Number(c.submitted ?? 0),
      indexed: Number(c.indexed ?? 0),
    })),
  }))
}

async function inspectTopPages(
  siteUrl: string,
  pages: GscTopRow[]
): Promise<{ inspections: GscInspection[]; inspectionsError: string | null }> {
  if (pages.length === 0) return { inspections: [], inspectionsError: null }
  const sc = searchconsole(READ_SCOPE)
  let firstError: string | null = null

  const one = async (p: GscTopRow): Promise<GscInspection> => {
    const pageUrl = p.key
    try {
      const res = await sc.urlInspection.index.inspect({
        requestBody: { inspectionUrl: pageUrl, siteUrl },
      })
      const idx = res.data.inspectionResult?.indexStatusResult ?? ({} as any)
      const mob = res.data.inspectionResult?.mobileUsabilityResult ?? ({} as any)
      const amp = res.data.inspectionResult?.ampResult ?? ({} as any)
      const rich = res.data.inspectionResult?.richResultsResult ?? ({} as any)
      return {
        page: pageUrl,
        clicks: p.clicks,
        impressions: p.impressions,
        verdict: idx.verdict ?? null,
        coverageState: idx.coverageState ?? null,
        robotsTxtState: idx.robotsTxtState ?? null,
        indexingState: idx.indexingState ?? null,
        pageFetchState: idx.pageFetchState ?? null,
        lastCrawlTime: idx.lastCrawlTime ?? null,
        crawledAs: idx.crawledAs ?? null,
        googleCanonical: idx.googleCanonical ?? null,
        userCanonical: idx.userCanonical ?? null,
        referringUrls: idx.referringUrls ?? [],
        sitemap: idx.sitemap ?? [],
        mobileVerdict: mob.verdict ?? null,
        ampVerdict: amp.verdict ?? null,
        richResultsVerdict: rich.verdict ?? null,
        error: null,
      }
    } catch (err: any) {
      const msg = String(err?.message ?? err)
      if (!firstError) firstError = msg
      return {
        page: pageUrl,
        clicks: p.clicks,
        impressions: p.impressions,
        verdict: null,
        coverageState: null,
        robotsTxtState: null,
        indexingState: null,
        pageFetchState: null,
        lastCrawlTime: null,
        crawledAs: null,
        googleCanonical: null,
        userCanonical: null,
        referringUrls: [],
        sitemap: [],
        mobileVerdict: null,
        ampVerdict: null,
        richResultsVerdict: null,
        error: msg,
      }
    }
  }

  const out = await Promise.all(pages.filter((p) => p.key).map(one))
  return { inspections: out, inspectionsError: firstError }
}
