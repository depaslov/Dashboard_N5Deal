import 'dotenv/config'
import { fetchGscSummary } from '../lib/analytics/gsc'
import { fetchGa4Summary } from '../lib/analytics/ga4'
import { google } from 'googleapis'
import { getJwtClient } from '../lib/analytics/google-auth'

const SITE = 'sc-domain:n5deal.com'
const GA4_PROPERTY = '515703727'
const SEP = { start: '2026-09-01', end: '2026-09-30' }
const OCT = { start: '2026-10-01', end: '2026-10-30' }

function pct(curr: number, prev: number): string {
  if (!prev) return curr ? '+∞%' : '0%'
  const d = ((curr - prev) / prev) * 100
  const sign = d >= 0 ? '+' : ''
  return `${sign}${d.toFixed(1)}%`
}

function diff(curr: number, prev: number): string {
  const d = curr - prev
  const sign = d >= 0 ? '+' : ''
  return `${sign}${d}`
}

async function ahrefsCall(path: string, params: Record<string, any>): Promise<any> {
  const token = process.env.AHREFS_API_TOKEN
  if (!token) return null
  const url = new URL('https://api.ahrefs.com/v3' + path)
  for (const [k, v] of Object.entries(params)) {
    if (v != null) url.searchParams.set(k, String(v))
  }
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } })
  if (!res.ok) {
    console.warn(`Ahrefs ${path} failed:`, res.status, await res.text())
    return null
  }
  return res.json()
}

async function ahrefsSnapshot(date: string) {
  const base = { target: 'n5deal.com', mode: 'domain', date, output: 'json' }
  const [dr, bs, m] = await Promise.all([
    ahrefsCall('/site-explorer/domain-rating', base),
    ahrefsCall('/site-explorer/backlinks-stats', base),
    ahrefsCall('/site-explorer/metrics', { ...base, volume_mode: 'monthly' }),
  ])
  const metrics = m?.metrics ?? m ?? {}
  return {
    domainRating: dr?.domain_rating?.domain_rating ?? dr?.domain_rating ?? null,
    refDomains: bs?.metrics?.live_refdomains ?? bs?.live_refdomains ?? metrics.refdomains ?? null,
    refDomainsDofollow: bs?.metrics?.live_refdomains_dofollow ?? bs?.live_refdomains_dofollow ?? null,
    backlinks: bs?.metrics?.live ?? bs?.live ?? metrics.backlinks ?? null,
    organicKeywords: metrics.organic_keywords ?? null,
    organicTraffic: metrics.organic_traffic ?? null,
  }
}

async function main() {
  console.log('Fetching GSC Sep + Oct…')
  const [gscSep, gscOct] = await Promise.all([
    fetchGscSummary(SITE, SEP),
    fetchGscSummary(SITE, OCT),
  ])

  console.log('Fetching GA4 Sep…')
  const ga4Sep = await fetchGa4Summary(GA4_PROPERTY, SEP)
  console.log('Fetching GA4 Oct…')
  const ga4Oct = await fetchGa4Summary(GA4_PROPERTY, OCT)

  console.log('Fetching Ahrefs snapshots…')
  const ahrSep = await ahrefsSnapshot('2026-09-30')
  const ahrOct = await ahrefsSnapshot('2026-10-30')

  // Index coverage counts
  const sc = google.searchconsole({ version: 'v1', auth: getJwtClient(['https://www.googleapis.com/auth/webmasters.readonly']) })
  const sm = await sc.sitemaps.list({ siteUrl: SITE }).catch(() => null)

  const summary = {
    gsc: {
      sep: gscSep.totals,
      oct: gscOct.totals,
      topQueriesOct: gscOct.topQueries.slice(0, 20),
      topQueriesSep: gscSep.topQueries.slice(0, 20),
      topPagesOct: gscOct.topPages.slice(0, 15),
    },
    ga4: {
      sep: ga4Sep.totals,
      oct: ga4Oct.totals,
      topChannelsOct: ga4Oct.topChannels.slice(0, 10),
      topChannelsSep: ga4Sep.topChannels.slice(0, 10),
      topPagesOct: ga4Oct.topPages.slice(0, 10),
    },
    ahrefs: { sep: ahrSep, oct: ahrOct },
    sitemaps: sm?.data ?? null,
  }

  console.log('\n============ GSC TOTALS ============')
  console.log('Metric            | Sep        | Oct        | Δ          | Δ%')
  console.log('------------------+------------+------------+------------+--------')
  const rows = [
    ['clicks', gscSep.totals.clicks, gscOct.totals.clicks],
    ['impressions', gscSep.totals.impressions, gscOct.totals.impressions],
    ['ctr', gscSep.totals.ctr, gscOct.totals.ctr],
    ['position', gscSep.totals.position, gscOct.totals.position],
  ] as const
  for (const [name, s, o] of rows) {
    const sNum = typeof s === 'number' ? s : Number(s)
    const oNum = typeof o === 'number' ? o : Number(o)
    console.log(
      `${String(name).padEnd(17)} | ${String(sNum.toFixed(2)).padStart(10)} | ${String(oNum.toFixed(2)).padStart(10)} | ${diff(oNum, sNum).padStart(10)} | ${pct(oNum, sNum)}`
    )
  }

  console.log('\n============ GA4 TOTALS ============')
  const ga4rows = [
    ['sessions', ga4Sep.totals.sessions, ga4Oct.totals.sessions],
    ['totalUsers', ga4Sep.totals.totalUsers, ga4Oct.totals.totalUsers],
    ['activeUsers', ga4Sep.totals.activeUsers, ga4Oct.totals.activeUsers],
    ['newUsers', ga4Sep.totals.newUsers, ga4Oct.totals.newUsers],
    ['screenPageViews', ga4Sep.totals.screenPageViews, ga4Oct.totals.screenPageViews],
    ['eventCount', ga4Sep.totals.eventCount, ga4Oct.totals.eventCount],
    ['conversions', ga4Sep.totals.conversions, ga4Oct.totals.conversions],
    ['engagementRate', ga4Sep.totals.engagementRate, ga4Oct.totals.engagementRate],
    ['bounceRate', ga4Sep.totals.bounceRate, ga4Oct.totals.bounceRate],
  ] as const
  for (const [name, s, o] of ga4rows) {
    const sNum = Number(s)
    const oNum = Number(o)
    console.log(`${String(name).padEnd(17)} | ${sNum.toFixed(2).padStart(10)} | ${oNum.toFixed(2).padStart(10)} | ${diff(oNum, sNum).padStart(10)} | ${pct(oNum, sNum)}`)
  }

  console.log('\n============ AHREFS ============')
  console.log(JSON.stringify({ sep: ahrSep, oct: ahrOct }, null, 2))

  console.log('\n============ TOP QUERIES OCT ============')
  for (const q of gscOct.topQueries.slice(0, 25)) {
    console.log(`${String(q.key).padEnd(45)} | imp=${String(q.impressions).padStart(6)} clicks=${String(q.clicks).padStart(4)} pos=${q.position.toFixed(1)}`)
  }

  console.log('\n============ DEMAND BUT NO CLICKS (OCT, imp>=200, clicks<=1) ============')
  const demandNoClicks = gscOct.topQueries
    .filter((q) => q.impressions >= 200 && q.clicks <= 1)
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 30)
  for (const q of demandNoClicks) {
    console.log(`${String(q.key).padEnd(45)} | imp=${String(q.impressions).padStart(6)} clicks=${String(q.clicks).padStart(4)} pos=${q.position.toFixed(1)} ctr=${(q.ctr*100).toFixed(2)}%`)
  }

  console.log('\n============ GA4 TOP CHANNELS OCT ============')
  for (const c of ga4Oct.topChannels.slice(0, 10)) {
    const sepRow = ga4Sep.topChannels.find((x) => x.key === c.key)
    console.log(`${String(c.key).padEnd(28)} | sessions=${c.sessions} (sep sessions=${sepRow?.sessions ?? 0})`)
  }

  console.log('\n============ SITEMAPS ============')
  if (sm?.data?.sitemap) {
    for (const s of sm.data.sitemap) {
      const contents = s.contents?.map((c: any) => `${c.type}:${c.submitted}/${c.indexed}`).join(', ')
      console.log(`${s.path} | last=${s.lastDownloaded} | errs=${s.errors} | warns=${s.warnings} | ${contents}`)
    }
  }

  // Save full dump
  const fs = await import('fs')
  fs.writeFileSync('tmp/compare-sep-oct-2026.json', JSON.stringify(summary, null, 2))
  console.log('\nSaved to tmp/compare-sep-oct-2026.json')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
