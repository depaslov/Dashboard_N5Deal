// Deep indexation scan — takes a list of URLs (typically the union of the
// site's sitemap and GSC's top-page list) and inspects each one via the Live
// URL Inspection API, then groups them into the same buckets Google shows in
// the GSC coverage report.

import { google } from 'googleapis'
import { getJwtClient } from './google-auth'

const SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly'
const BATCH_SIZE = 25          // URL Inspection API tolerates ~10 QPS easily
const MAX_URLS_TO_INSPECT = 300 // stays well under 2k/day/property quota

export type CoverageBucket =
  | 'indexed_submitted'
  | 'indexed_not_submitted'
  | 'duplicate_no_canonical'
  | 'duplicate_diff_canonical'
  | 'redirect'
  | 'noindex'
  | 'alt_canonical'
  | 'robots_blocked'
  | 'crawled_not_indexed'
  | 'discovered_not_indexed'
  | 'redirect_error'
  | 'not_found'
  | 'soft_404'
  | 'server_error'
  | 'other'
  | 'error'

export interface CoveragePage {
  url: string
  bucket: CoverageBucket
  verdict: string | null
  coverageState: string | null
  indexingState: string | null
  robotsTxtState: string | null
  pageFetchState: string | null
  lastCrawlTime: string | null
  crawledAs: string | null
  googleCanonical: string | null
  userCanonical: string | null
  sitemap: string[]
  referringUrls: string[]
  inSitemap: boolean         // did we find it in the sitemap we started with?
  error: string | null
}

export interface CoverageGroup {
  bucket: CoverageBucket
  severity: 'critical' | 'warning' | 'info' | 'ok'
  titleUa: string            // Ukrainian label matching GSC UI
  titleEn: string
  explanation: string
  fix: string
  pages: CoveragePage[]
}

export interface DeepIndexationReport {
  scannedAt: string
  siteUrl: string
  totalInSitemap: number
  totalInspected: number
  totalErrored: number
  quotaWarning: string | null
  indexedCount: number
  problemCount: number
  groups: CoverageGroup[]
}

function classify(iRes: any): CoverageBucket {
  if (!iRes) return 'other'
  const idx = iRes.indexStatusResult ?? {}
  const verdict = idx.verdict ?? ''
  const cov = String(idx.coverageState ?? '').toLowerCase()
  const indexingState = idx.indexingState ?? ''
  const robots = idx.robotsTxtState ?? ''
  const fetchState = idx.pageFetchState ?? ''

  if (fetchState === 'NOT_FOUND' || /not found \(404\)/.test(cov)) return 'not_found'
  if (fetchState === 'SOFT_404' || /soft 404/.test(cov)) return 'soft_404'
  if (fetchState === 'ACCESS_DENIED' || fetchState === 'ACCESS_FORBIDDEN' || fetchState === 'SERVER_ERROR') return 'server_error'

  if (robots === 'DISALLOWED' || /blocked by robots\.txt/.test(cov)) return 'robots_blocked'
  if (indexingState === 'BLOCKED_BY_META_TAG' || indexingState === 'BLOCKED_BY_HTTP_HEADER' || /excluded by ['"]?noindex/.test(cov)) return 'noindex'

  if (/redirect error/.test(cov)) return 'redirect_error'
  if (/page with redirect/.test(cov)) return 'redirect'
  if (/alternate page with (proper|correct) canonical/.test(cov)) return 'alt_canonical'
  if (/duplicate.*google chose/i.test(cov) || /duplicate, google chose/.test(cov)) return 'duplicate_diff_canonical'
  if (/duplicate.*user[- ]selected/i.test(cov) || /duplicate without user[- ]selected/.test(cov)) return 'duplicate_no_canonical'
  if (/crawled - currently not indexed/.test(cov) || /crawled – currently not indexed/.test(cov)) return 'crawled_not_indexed'
  if (/discovered - currently not indexed/.test(cov) || /discovered – currently not indexed/.test(cov)) return 'discovered_not_indexed'
  if (verdict === 'PASS' && /submitted and indexed/.test(cov)) return 'indexed_submitted'
  if (verdict === 'PASS' && /indexed, not submitted/.test(cov)) return 'indexed_not_submitted'
  if (verdict === 'PASS') return 'indexed_not_submitted'
  return 'other'
}

const BUCKET_META: Record<
  CoverageBucket,
  { severity: 'critical' | 'warning' | 'info' | 'ok'; titleUa: string; titleEn: string; explanation: string; fix: string }
> = {
  indexed_submitted: {
    severity: 'ok',
    titleUa: 'Проіндексовано (є в sitemap)',
    titleEn: 'Submitted and indexed',
    explanation: 'Google має ці сторінки в індексі і бачить їх у твоєму sitemap. Все добре.',
    fix: 'Нічого не робити.',
  },
  indexed_not_submitted: {
    severity: 'info',
    titleUa: 'Проіндексовано (не в sitemap)',
    titleEn: 'Indexed, not submitted in sitemap',
    explanation: 'Google знайшов і проіндексував сторінки через внутрішні лінки, але їх немає в sitemap.',
    fix: 'Додай ці URL у sitemap.xml щоб Google знав що вони важливі і краще їх пере-краулив.',
  },
  duplicate_no_canonical: {
    severity: 'warning',
    titleUa: 'Дублікат — canonical не вибрано користувачем',
    titleEn: 'Duplicate without user-selected canonical',
    explanation:
      'Google бачить ці сторінки як дублікати іншої сторінки, а ти не вказав rel="canonical" в HTML щоб направити Google до правильного варіанту. Тому Google сам обирає який варіант індексувати — і часто це не той що ти хочеш.',
    fix:
      'Додай <link rel="canonical" href="..." /> в <head> цих сторінок, вказуючи на основну версію. Якщо всі варіанти справді унікальні — переписати щоб не виглядали як дублікати.',
  },
  duplicate_diff_canonical: {
    severity: 'warning',
    titleUa: 'Дублікат — Google обрав інший canonical',
    titleEn: 'Duplicate, Google chose different canonical than user',
    explanation:
      'Ти вказав canonical на одну сторінку, але Google вирішив канонічною версією іншу сторінку. Це означає що Google не довіряє твоїй canonical-декларації.',
    fix:
      'Причини зазвичай: (1) слабкі внутрішні лінки на "твою" canonical, (2) hreflang конфліктує з canonical, (3) контент занадто схожий. Прибери дублювання контенту або підсили твою canonical внутрішніми лінками.',
  },
  redirect: {
    severity: 'info',
    titleUa: 'Сторінка з переадресацією',
    titleEn: 'Page with redirect',
    explanation:
      'Ці URL віддають 301/302 редирект. Google індексує сторінку призначення замість цієї.',
    fix:
      'Якщо редирект правильний — нічого не робити. Якщо не повинно бути редиректу — прибери його з .htaccess/nginx.conf/next.config або з коду.',
  },
  noindex: {
    severity: 'critical',
    titleUa: 'Заборонено тегом noindex',
    titleEn: 'Excluded by noindex tag',
    explanation:
      'Ці сторінки мають <meta name="robots" content="noindex"> в HTML або X-Robots-Tag: noindex в HTTP-заголовку. Google не буде їх індексувати.',
    fix:
      'Якщо сторінки мають ранжуватися — прибери noindex з metadata (для Next.js: у app router це метадата `robots: { index: false }` в page.tsx або middleware). Після зняття — Request Indexing в GSC.',
  },
  alt_canonical: {
    severity: 'ok',
    titleUa: 'Альтернативна сторінка з canonical',
    titleEn: 'Alternate page with proper canonical tag',
    explanation:
      'Ці сторінки правильно вказують canonical на основну версію (напр. мовна альтернатива, мобільна версія). Google індексує canonical, не ці. Це нормально.',
    fix: 'Нічого не робити — це коректна конфігурація дублікатів.',
  },
  robots_blocked: {
    severity: 'critical',
    titleUa: 'Заблоковано в robots.txt',
    titleEn: 'Blocked by robots.txt',
    explanation:
      'Твій /robots.txt має Disallow-правило що блокує ці URL. Google не може навіть краулити ці сторінки.',
    fix:
      'Відредагуй /robots.txt — прибери або звузи Disallow-правило. Після цього дай Google 1-2 дні і request indexing.',
  },
  crawled_not_indexed: {
    severity: 'critical',
    titleUa: 'Проскановано, але не проіндексовано',
    titleEn: 'Crawled - currently not indexed',
    explanation:
      'Google просканував ці сторінки, побачив їх контент, але вирішив НЕ індексувати. Зазвичай означає: контент занадто тонкий/дублікатний/шаблонний, або запити на нього мають нульовий попит, або сайт має проблеми з якістю в цілому. Це найгірша категорія — Google активно відхиляє контент.',
    fix:
      '1) Перевір чи контент справді має цінність — унікальні дані, дослідження, глибина. 2) Додай внутрішні лінки з топ-сторінок сайту. 3) Об\'єднай схожі сторінки в одну більш якісну. 4) Додай структуровані дані (FAQ, Article). 5) Після покращення — Request Indexing в GSC.',
  },
  discovered_not_indexed: {
    severity: 'critical',
    titleUa: 'Виявлено, але не проіндексовано',
    titleEn: 'Discovered - currently not indexed',
    explanation:
      'Google знає що ці сторінки існують (через sitemap або внутрішні лінки), але ще не краулив їх. Причина: у Google обмежений crawl budget на твій сайт і він вирішив що ці сторінки не пріоритетні.',
    fix:
      '1) Прибери непотрібні сторінки з sitemap (thin/duplicate/noindex) щоб не витрачати crawl budget. 2) Прискор сайт (INP/LCP) — швидші сайти краще краулять. 3) Додай сильні внутрішні лінки з головних сторінок. 4) Для критичних сторінок — Request Indexing вручну.',
  },
  redirect_error: {
    severity: 'critical',
    titleUa: 'Помилка редиректу',
    titleEn: 'Redirect error',
    explanation:
      'Ці URL мають зламану ланцюжок редиректів — можливо, циклічний редирект, редирект на 404, або занадто довгий ланцюжок.',
    fix:
      'Перевір ланцюжок: curl -IL <url>. Виправ на прямий редирект (max 1 хоп) на робочий URL. Redirect chains >3 гарантовано ламають індексацію.',
  },
  not_found: {
    severity: 'critical',
    titleUa: 'Не знайдено (404)',
    titleEn: 'Not found (404)',
    explanation:
      'Ці URL віддають HTTP 404 але вони в sitemap або внутрішньо злінковані. Google не може індексувати неіснуючі сторінки.',
    fix:
      'Або (1) відновити сторінку, або (2) поставити 301-редирект на існуючу схожу сторінку, або (3) прибрати URL з sitemap та зі всіх внутрішніх лінків.',
  },
  soft_404: {
    severity: 'warning',
    titleUa: 'Soft 404',
    titleEn: 'Soft 404',
    explanation:
      'Ці сторінки віддають статус 200, але Google вирішив що вони виглядають як 404 (пусті, "no results", "not found" в контенті).',
    fix:
      'Або (1) додай реальний контент замість пустоти, або (2) поверни справжній статус 404 коли контенту нема.',
  },
  server_error: {
    severity: 'critical',
    titleUa: 'Серверна помилка',
    titleEn: 'Server error / access forbidden',
    explanation:
      'Google отримав 5xx або 403 при спробі краулити ці URL.',
    fix:
      'Перевір server logs та CDN на Googlebot user-agent. Часто причина — WAF/rate-limiting блокує Googlebot.',
  },
  other: {
    severity: 'info',
    titleUa: 'Інше',
    titleEn: 'Other coverage state',
    explanation: 'Google повернув нестандартний coverage state.',
    fix: 'Відкрий сторінку в GSC → URL Inspection для деталей.',
  },
  error: {
    severity: 'warning',
    titleUa: 'Помилка інспекції',
    titleEn: 'Inspection API error',
    explanation: 'URL Inspection API повернув помилку для цих URL (найчастіше — вичерпаний денний ліміт 2000 запитів).',
    fix: 'Почекай наступний день або запусти скан на менший діапазон URL.',
  },
}

function inspectorClient() {
  const auth = getJwtClient([SCOPE])
  return google.searchconsole({ version: 'v1', auth })
}

async function inspectOne(
  sc: ReturnType<typeof inspectorClient>,
  siteUrl: string,
  url: string
): Promise<{ ok: true; result: any } | { ok: false; error: string }> {
  try {
    const res = await sc.urlInspection.index.inspect({
      requestBody: { inspectionUrl: url, siteUrl },
    })
    return { ok: true, result: res.data.inspectionResult ?? {} }
  } catch (err: any) {
    return { ok: false, error: String(err?.message ?? err) }
  }
}

export async function runDeepIndexationScan(
  siteUrl: string,
  candidateUrls: string[],
  sitemapUrlSet: Set<string>
): Promise<DeepIndexationReport> {
  const urls = candidateUrls.slice(0, MAX_URLS_TO_INSPECT)
  const sc = inspectorClient()

  const pages: CoveragePage[] = []
  let quotaWarning: string | null = null
  let hardStop = false

  // Batch in slices to respect the 600/min-per-user URL Inspection quota.
  for (let i = 0; i < urls.length && !hardStop; i += BATCH_SIZE) {
    const slice = urls.slice(i, i + BATCH_SIZE)
    const results = await Promise.all(slice.map((u) => inspectOne(sc, siteUrl, u)))
    for (let j = 0; j < slice.length; j++) {
      const u = slice[j]
      const r = results[j]
      if (r.ok) {
        const idx = r.result.indexStatusResult ?? {}
        pages.push({
          url: u,
          bucket: classify(r.result),
          verdict: idx.verdict ?? null,
          coverageState: idx.coverageState ?? null,
          indexingState: idx.indexingState ?? null,
          robotsTxtState: idx.robotsTxtState ?? null,
          pageFetchState: idx.pageFetchState ?? null,
          lastCrawlTime: idx.lastCrawlTime ?? null,
          crawledAs: idx.crawledAs ?? null,
          googleCanonical: idx.googleCanonical ?? null,
          userCanonical: idx.userCanonical ?? null,
          sitemap: idx.sitemap ?? [],
          referringUrls: idx.referringUrls ?? [],
          inSitemap: sitemapUrlSet.has(u),
          error: null,
        })
      } else {
        pages.push({
          url: u,
          bucket: 'error',
          verdict: null,
          coverageState: null,
          indexingState: null,
          robotsTxtState: null,
          pageFetchState: null,
          lastCrawlTime: null,
          crawledAs: null,
          googleCanonical: null,
          userCanonical: null,
          sitemap: [],
          referringUrls: [],
          inSitemap: sitemapUrlSet.has(u),
          error: r.error,
        })
        if (/quota|limit|exceeded|429/i.test(r.error)) {
          quotaWarning = r.error
          hardStop = true
          break
        }
      }
    }
  }

  // Group by bucket
  const byBucket = new Map<CoverageBucket, CoveragePage[]>()
  for (const p of pages) {
    if (!byBucket.has(p.bucket)) byBucket.set(p.bucket, [])
    byBucket.get(p.bucket)!.push(p)
  }

  const severityRank: Record<string, number> = { critical: 0, warning: 1, info: 2, ok: 3 }
  const groups: CoverageGroup[] = Array.from(byBucket.entries())
    .map(([bucket, list]) => {
      const meta = BUCKET_META[bucket]
      return {
        bucket,
        severity: meta.severity,
        titleUa: meta.titleUa,
        titleEn: meta.titleEn,
        explanation: meta.explanation,
        fix: meta.fix,
        pages: list.sort((a, b) => a.url.localeCompare(b.url)),
      }
    })
    .sort((a, b) => severityRank[a.severity] - severityRank[b.severity] || b.pages.length - a.pages.length)

  const indexedCount = pages.filter((p) => p.bucket === 'indexed_submitted' || p.bucket === 'indexed_not_submitted' || p.bucket === 'alt_canonical').length
  const problemCount = pages.length - indexedCount - pages.filter((p) => p.bucket === 'error').length

  return {
    scannedAt: new Date().toISOString(),
    siteUrl,
    totalInSitemap: sitemapUrlSet.size,
    totalInspected: pages.length,
    totalErrored: pages.filter((p) => p.bucket === 'error').length,
    quotaWarning,
    indexedCount,
    problemCount,
    groups,
  }
}
