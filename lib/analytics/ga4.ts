import { BetaAnalyticsDataClient } from '@google-analytics/data'
import { getServiceAccountCredentials } from './google-auth'

export interface Ga4DailyRow {
  date: string
  sessions: number
  totalUsers: number
  newUsers: number
  activeUsers: number
  screenPageViews: number
  engagementRate: number
  averageSessionDuration: number
  bounceRate: number
  conversions: number
  eventCount: number
}

export interface Ga4TopRow {
  key: string
  sessions: number
  users: number
  screenPageViews?: number
  conversions?: number
  engagementRate?: number
  averageSessionDuration?: number
  bounceRate?: number
  activeUsers?: number
  engagedSessions?: number
  userEngagementDuration?: number
  eventCount?: number
  averageEngagementPerUser?: number
}

export interface Ga4PageByCountry {
  page: string
  country: string
  sessions: number
  users: number
  screenPageViews: number
}

export interface Ga4EventRow {
  eventName: string
  eventCount: number
  users: number
  eventsPerUser: number
}

export interface Ga4Summary {
  totals: {
    sessions: number
    totalUsers: number
    newUsers: number
    activeUsers: number
    screenPageViews: number
    engagementRate: number
    averageSessionDuration: number
    bounceRate: number
    conversions: number
    eventCount: number
    screenPageViewsPerSession: number
    sessionsPerUser: number
  }
  daily: Ga4DailyRow[]
  topPages: Ga4TopRow[]
  topLandingPages: Ga4TopRow[]
  topSources: Ga4TopRow[]
  topChannels: Ga4TopRow[]
  topReferrers: Ga4TopRow[]
  topCountries: Ga4TopRow[]
  topCities: Ga4TopRow[]
  topDevices: Ga4TopRow[]
  topBrowsers: Ga4TopRow[]
  topOs: Ga4TopRow[]
  topEvents: Ga4EventRow[]
  topPagesByCountry: Ga4PageByCountry[]
}

let cachedClient: BetaAnalyticsDataClient | null = null

function client(): BetaAnalyticsDataClient {
  if (cachedClient) return cachedClient
  const creds = getServiceAccountCredentials()
  cachedClient = new BetaAnalyticsDataClient({
    credentials: {
      client_email: creds.client_email,
      private_key: creds.private_key,
    },
    projectId: creds.project_id,
  })
  return cachedClient
}

function propertyPath(propertyId: string): string {
  const id = propertyId.replace(/^properties\//, '')
  return `properties/${id}`
}

function num(v: string | number | null | undefined): number {
  if (v == null) return 0
  const n = typeof v === 'number' ? v : parseFloat(v)
  return Number.isFinite(n) ? n : 0
}

function toIsoFromCompact(compact: string): string {
  if (!compact || compact.length !== 8) return compact
  return `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}`
}

export async function fetchGa4Summary(propertyId: string, range: { start: string; end: string }): Promise<Ga4Summary> {
  const c = client()
  const property = propertyPath(propertyId)
  const dateRanges = [{ startDate: range.start, endDate: range.end }]

  const dailyReq = c.runReport({
    property,
    dateRanges,
    dimensions: [{ name: 'date' }],
    metrics: [
      { name: 'sessions' },
      { name: 'totalUsers' },
      { name: 'newUsers' },
      { name: 'activeUsers' },
      { name: 'screenPageViews' },
      { name: 'engagementRate' },
      { name: 'averageSessionDuration' },
      { name: 'bounceRate' },
      { name: 'conversions' },
      { name: 'eventCount' },
    ],
    orderBys: [{ dimension: { dimensionName: 'date' } }],
    limit: 1000,
  })

  const topPagesReq = c.runReport({
    property,
    dateRanges,
    dimensions: [{ name: 'pagePath' }, { name: 'pageTitle' }],
    metrics: [
      { name: 'sessions' },
      { name: 'totalUsers' },
      { name: 'screenPageViews' },
      { name: 'conversions' },
      { name: 'engagementRate' },
      { name: 'averageSessionDuration' },
      { name: 'bounceRate' },
    ],
    orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
    limit: 50,
  })

  const topLandingReq = c.runReport({
    property,
    dateRanges,
    dimensions: [{ name: 'landingPage' }],
    metrics: [
      { name: 'sessions' },
      { name: 'totalUsers' },
      { name: 'activeUsers' },
      { name: 'engagedSessions' },
      { name: 'engagementRate' },
      { name: 'userEngagementDuration' },
      { name: 'eventCount' },
      { name: 'bounceRate' },
      { name: 'conversions' },
    ],
    orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
    limit: 100,
  })

  const topSourcesReq = c.runReport({
    property,
    dateRanges,
    dimensions: [{ name: 'sessionSource' }, { name: 'sessionMedium' }],
    metrics: [
      { name: 'sessions' },
      { name: 'totalUsers' },
      { name: 'engagementRate' },
      { name: 'conversions' },
    ],
    orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
    limit: 30,
  })

  const topChannelsReq = c.runReport({
    property,
    dateRanges,
    dimensions: [{ name: 'sessionDefaultChannelGroup' }],
    metrics: [
      { name: 'sessions' },
      { name: 'totalUsers' },
      { name: 'engagementRate' },
      { name: 'conversions' },
    ],
    orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
    limit: 15,
  })

  const topReferrersReq = c.runReport({
    property,
    dateRanges,
    dimensions: [{ name: 'pageReferrer' }],
    metrics: [{ name: 'sessions' }, { name: 'totalUsers' }],
    orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
    limit: 30,
  })

  const topCountriesReq = c.runReport({
    property,
    dateRanges,
    dimensions: [{ name: 'country' }],
    metrics: [
      { name: 'sessions' },
      { name: 'totalUsers' },
      { name: 'engagementRate' },
      { name: 'conversions' },
    ],
    orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
    limit: 30,
  })

  const topCitiesReq = c.runReport({
    property,
    dateRanges,
    dimensions: [{ name: 'city' }, { name: 'country' }],
    metrics: [{ name: 'sessions' }, { name: 'totalUsers' }],
    orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
    limit: 25,
  })

  const topDevicesReq = c.runReport({
    property,
    dateRanges,
    dimensions: [{ name: 'deviceCategory' }],
    metrics: [
      { name: 'sessions' },
      { name: 'totalUsers' },
      { name: 'engagementRate' },
      { name: 'conversions' },
    ],
    orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
    limit: 10,
  })

  const topBrowsersReq = c.runReport({
    property,
    dateRanges,
    dimensions: [{ name: 'browser' }],
    metrics: [{ name: 'sessions' }, { name: 'totalUsers' }],
    orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
    limit: 15,
  })

  const topOsReq = c.runReport({
    property,
    dateRanges,
    dimensions: [{ name: 'operatingSystem' }],
    metrics: [{ name: 'sessions' }, { name: 'totalUsers' }],
    orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
    limit: 15,
  })

  const topEventsReq = c.runReport({
    property,
    dateRanges,
    dimensions: [{ name: 'eventName' }],
    metrics: [{ name: 'eventCount' }, { name: 'totalUsers' }, { name: 'eventCountPerUser' }],
    orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
    limit: 25,
  })

  const topPagesByCountryReq = c.runReport({
    property,
    dateRanges,
    dimensions: [{ name: 'pagePath' }, { name: 'country' }],
    metrics: [{ name: 'sessions' }, { name: 'totalUsers' }, { name: 'screenPageViews' }],
    orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
    limit: 50,
  })

  const [
    daily,
    topPages,
    topLanding,
    topSources,
    topChannels,
    topReferrers,
    topCountries,
    topCities,
    topDevices,
    topBrowsers,
    topOs,
    topEvents,
    topPagesByCountry,
  ] = await Promise.all([
    dailyReq,
    topPagesReq,
    topLandingReq,
    topSourcesReq,
    topChannelsReq,
    topReferrersReq,
    topCountriesReq,
    topCitiesReq,
    topDevicesReq,
    topBrowsersReq,
    topOsReq,
    topEventsReq,
    topPagesByCountryReq,
  ])

  const dailyRows: Ga4DailyRow[] = (daily[0]?.rows ?? []).map((r) => {
    const mv = r.metricValues ?? []
    return {
      date: toIsoFromCompact(r.dimensionValues?.[0]?.value ?? ''),
      sessions: num(mv[0]?.value),
      totalUsers: num(mv[1]?.value),
      newUsers: num(mv[2]?.value),
      activeUsers: num(mv[3]?.value),
      screenPageViews: num(mv[4]?.value),
      engagementRate: num(mv[5]?.value),
      averageSessionDuration: num(mv[6]?.value),
      bounceRate: num(mv[7]?.value),
      conversions: num(mv[8]?.value),
      eventCount: num(mv[9]?.value),
    }
  })

  const totals = dailyRows.reduce(
    (acc, r) => {
      acc.sessions += r.sessions
      acc.totalUsers += r.totalUsers
      acc.newUsers += r.newUsers
      acc.activeUsers += r.activeUsers
      acc.screenPageViews += r.screenPageViews
      acc.conversions += r.conversions
      acc.eventCount += r.eventCount
      return acc
    },
    {
      sessions: 0,
      totalUsers: 0,
      newUsers: 0,
      activeUsers: 0,
      screenPageViews: 0,
      engagementRate: 0,
      averageSessionDuration: 0,
      bounceRate: 0,
      conversions: 0,
      eventCount: 0,
      screenPageViewsPerSession: 0,
      sessionsPerUser: 0,
    }
  )
  const sessionsDaysWithTraffic = dailyRows.reduce((a, r) => a + (r.sessions > 0 ? 1 : 0), 0) || 1
  totals.engagementRate = dailyRows.reduce((a, r) => a + r.engagementRate, 0) / sessionsDaysWithTraffic
  totals.bounceRate = dailyRows.reduce((a, r) => a + r.bounceRate, 0) / sessionsDaysWithTraffic
  totals.averageSessionDuration =
    dailyRows.reduce((a, r) => a + r.averageSessionDuration * r.sessions, 0) / (totals.sessions || 1)
  totals.screenPageViewsPerSession = totals.sessions > 0 ? totals.screenPageViews / totals.sessions : 0
  totals.sessionsPerUser = totals.totalUsers > 0 ? totals.sessions / totals.totalUsers : 0

  const mapRow = (row: any, joiner?: (parts: string[]) => string): Ga4TopRow => {
    const parts = (row.dimensionValues ?? []).map((d: any) => d.value ?? '')
    const key = joiner ? joiner(parts) : parts.join(' / ')
    const mv = row.metricValues ?? []
    return {
      key: key || '(not set)',
      sessions: num(mv[0]?.value),
      users: num(mv[1]?.value),
      screenPageViews: mv[2]?.value != null ? num(mv[2]?.value) : undefined,
      conversions: mv[3]?.value != null ? num(mv[3]?.value) : undefined,
      engagementRate: undefined,
      averageSessionDuration: undefined,
      bounceRate: undefined,
    }
  }

  const mapPage = (row: any): Ga4TopRow => {
    const parts = (row.dimensionValues ?? []).map((d: any) => d.value ?? '')
    const mv = row.metricValues ?? []
    return {
      key: parts[0] || '(root)',
      sessions: num(mv[0]?.value),
      users: num(mv[1]?.value),
      screenPageViews: num(mv[2]?.value),
      conversions: num(mv[3]?.value),
      engagementRate: num(mv[4]?.value),
      averageSessionDuration: num(mv[5]?.value),
      bounceRate: num(mv[6]?.value),
    }
  }

  const mapLanding = (row: any): Ga4TopRow => {
    const parts = (row.dimensionValues ?? []).map((d: any) => d.value ?? '')
    const mv = row.metricValues ?? []
    const active = num(mv[2]?.value)
    const engagement = num(mv[5]?.value)
    return {
      key: parts[0] || '(root)',
      sessions: num(mv[0]?.value),
      users: num(mv[1]?.value),
      activeUsers: active,
      engagedSessions: num(mv[3]?.value),
      engagementRate: num(mv[4]?.value),
      userEngagementDuration: engagement,
      averageEngagementPerUser: active > 0 ? engagement / active : 0,
      eventCount: num(mv[6]?.value),
      bounceRate: num(mv[7]?.value),
      conversions: num(mv[8]?.value),
    }
  }

  const mapChannel = (row: any): Ga4TopRow => {
    const parts = (row.dimensionValues ?? []).map((d: any) => d.value ?? '')
    const mv = row.metricValues ?? []
    return {
      key: parts[0] || '(direct)',
      sessions: num(mv[0]?.value),
      users: num(mv[1]?.value),
      engagementRate: num(mv[2]?.value),
      conversions: num(mv[3]?.value),
    }
  }

  return {
    totals,
    daily: dailyRows,
    topPages: (topPages[0]?.rows ?? []).map(mapPage),
    topLandingPages: (topLanding[0]?.rows ?? []).map(mapLanding),
    topSources: (topSources[0]?.rows ?? []).map((r) => mapRow(r, (p) => `${p[0] || 'direct'} / ${p[1] || 'none'}`)),
    topChannels: (topChannels[0]?.rows ?? []).map(mapChannel),
    topReferrers: (topReferrers[0]?.rows ?? [])
      .map((r) => mapRow(r, (p) => p[0] || '(none)'))
      .filter((r) => r.key && r.key !== '(none)'),
    topCountries: (topCountries[0]?.rows ?? []).map(mapChannel),
    topCities: (topCities[0]?.rows ?? []).map((r) => mapRow(r, (p) => `${p[0] || '(unknown)'} , ${p[1] || ''}`)),
    topDevices: (topDevices[0]?.rows ?? []).map(mapChannel),
    topBrowsers: (topBrowsers[0]?.rows ?? []).map((r) => mapRow(r, (p) => p[0] || '(unknown)')),
    topOs: (topOs[0]?.rows ?? []).map((r) => mapRow(r, (p) => p[0] || '(unknown)')),
    topEvents: (topEvents[0]?.rows ?? []).map((r) => {
      const mv = r.metricValues ?? []
      return {
        eventName: r.dimensionValues?.[0]?.value ?? '',
        eventCount: num(mv[0]?.value),
        users: num(mv[1]?.value),
        eventsPerUser: num(mv[2]?.value),
      }
    }),
    topPagesByCountry: (topPagesByCountry[0]?.rows ?? []).map((r) => {
      const parts = (r.dimensionValues ?? []).map((d: any) => d.value ?? '')
      const mv = r.metricValues ?? []
      return {
        page: parts[0] || '(root)',
        country: parts[1] || '(unknown)',
        sessions: num(mv[0]?.value),
        users: num(mv[1]?.value),
        screenPageViews: num(mv[2]?.value),
      }
    }),
  }
}
