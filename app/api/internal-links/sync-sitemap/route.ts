import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getOrCreateCurrentProject } from '@/lib/project'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

const DEFAULT_SITEMAP_URL = 'https://n5deal.com/sitemap.xml'

// Canonical anchor + category overrides for the well-known landing pages.
// Auto-derivation from slug is fine for nested pages (articles, glossary,
// listings), but the top-level money pages deserve handwritten anchors.
const URL_OVERRIDES: Record<string, { anchor: string; category: string; priority?: 'must' | 'nice'; anchorAlts?: string[]; context?: string }> = {
  '/': {
    anchor: 'n5deal home',
    category: 'landing',
    anchorAlts: ['n5deal platform', 'n5deal'],
    context: 'Use sparingly — only when referencing the platform overall.',
  },
  '/buyer': {
    anchor: 'buy a licensed business',
    category: 'product',
    priority: 'must',
    anchorAlts: ['buy a business', 'acquire a licensed business', 'browse businesses for sale'],
    context: 'Use when an article discusses acquiring an existing licensed entity.',
  },
  '/seller': {
    anchor: 'sell your business',
    category: 'product',
    anchorAlts: ['list your business', 'list your licensed business', 'sell a licensed fintech'],
    context: 'Use when content addresses founders/owners considering exit.',
  },
  '/all-listing': {
    anchor: 'licensed business marketplace',
    category: 'product',
    priority: 'must',
    anchorAlts: ['marketplace of licensed companies', 'all available listings', 'see all licensed companies for sale'],
    context: 'Use when referring to the live inventory of licensed companies.',
  },
  '/incorporation-license': {
    anchor: 'incorporate a licensed company',
    category: 'product',
    priority: 'must',
    anchorAlts: ['licensed incorporation', 'incorporate with a license', 'get a licensed entity'],
    context: 'Use when content discusses obtaining a new license + entity together.',
  },
  '/incorporation-license/fintech': {
    anchor: 'fintech incorporation license',
    category: 'product',
    anchorAlts: ['fintech license incorporation', 'license a fintech company'],
    context: 'Use for content about fintech-specific licensing paths.',
  },
  '/incorporation-license/crypto': {
    anchor: 'crypto incorporation license',
    category: 'product',
    anchorAlts: ['crypto license incorporation', 'license a crypto company', 'VASP license setup'],
    context: 'Use for crypto / VASP / MiCA / digital-asset licensing content.',
  },
  '/get-free-valuation': {
    anchor: 'get a free valuation',
    category: 'product',
    anchorAlts: ['free business valuation', 'valuate your business'],
    context: 'Use when content discusses pricing, exit prep, or knowing what a business is worth.',
  },
  '/get-free-valuation/valuation-calculator': {
    anchor: 'business valuation calculator',
    category: 'product',
    anchorAlts: ['valuation calculator', 'estimate business value'],
  },
  '/fintech-builder': {
    anchor: 'fintech builder',
    category: 'product',
    anchorAlts: ['build a fintech', 'fintech infrastructure builder', 'n5deal fintech builder'],
    context: 'Use when content discusses tech-stack assembly, white-label rails, or building from scratch.',
  },
  '/market-news': {
    anchor: 'market news',
    category: 'content',
    anchorAlts: ['latest market news', 'fintech market news'],
  },
  '/articles': {
    anchor: 'articles and guides',
    category: 'content',
    anchorAlts: ['n5deal articles', 'long-form guides'],
  },
  '/youtube': {
    anchor: 'n5deal on YouTube',
    category: 'content',
    anchorAlts: ['watch on YouTube', 'video content'],
  },
  '/glossary': {
    anchor: 'fintech glossary',
    category: 'resource',
    anchorAlts: ['glossary', 'fintech terms', 'licensing glossary'],
    context: 'Use when a niche term is mentioned and a definition is helpful.',
  },
  '/events': {
    anchor: 'upcoming events',
    category: 'content',
    anchorAlts: ['events', 'fintech events'],
  },
  '/partner': {
    anchor: 'partner with n5deal',
    category: 'landing',
    anchorAlts: ['become a partner', 'partner program'],
  },
  '/faq': {
    anchor: 'frequently asked questions',
    category: 'resource',
    priority: 'must',
    anchorAlts: ['FAQ', 'common questions', 'questions and answers'],
    context: 'Use near the end of an article when readers may still have questions.',
  },
  '/legal/terms-of-use': { anchor: 'terms of use', category: 'legal' },
  '/legal/privacy-policy': { anchor: 'privacy policy', category: 'legal' },
  '/legal/cookie-policy': { anchor: 'cookie policy', category: 'legal' },
}

// Derive a category from the path when no override exists.
function deriveCategory(path: string): string {
  const parts = path.split('/').filter(Boolean)
  if (parts.length === 0) return 'landing'
  const top = parts[0]
  if (['legal'].includes(top)) return 'legal'
  if (['articles'].includes(top)) return 'article'
  if (['market-news'].includes(top)) return 'news'
  if (['glossary'].includes(top)) return 'glossary'
  if (['all-listing'].includes(top)) return 'listing'
  if (['youtube'].includes(top)) return 'youtube'
  if (['events'].includes(top)) return 'event'
  if (['incorporation-license', 'fintech-builder', 'buyer', 'seller', 'get-free-valuation', 'partner'].includes(top)) return 'product'
  return 'content'
}

// Convert a slug like "buy-a-licensed-business" into a natural anchor phrase.
function slugToAnchor(slug: string): string {
  return slug
    .split('-')
    .map((w) => w.toLowerCase())
    .join(' ')
    .trim()
}

function deriveAnchorFromPath(path: string): string {
  const parts = path.split('/').filter(Boolean)
  if (parts.length === 0) return 'n5deal'
  return slugToAnchor(parts[parts.length - 1])
}

function parseSitemapXml(xml: string): string[] {
  const urls: string[] = []
  const regex = /<loc>([^<]+)<\/loc>/gi
  let m: RegExpExecArray | null
  while ((m = regex.exec(xml)) !== null) {
    urls.push(m[1].trim())
  }
  return urls
}

function toRelativePath(absoluteUrl: string, expectedOrigin: string): string | null {
  try {
    const u = new URL(absoluteUrl)
    if (u.origin !== expectedOrigin) return null
    // Drop trailing slash except for root
    let p = u.pathname
    if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1)
    return p
  } catch {
    return null
  }
}

interface SyncResult {
  total: number
  created: number
  skipped: number
  deactivated: number
  reactivated: number
  details: {
    created: string[]
    deactivated: string[]
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id as string | undefined
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: any = {}
  try { body = await req.json() } catch { /* empty body is ok */ }
  const sitemapUrl = String(body?.sitemapUrl ?? DEFAULT_SITEMAP_URL).trim()
  // When true, URLs in DB that are NOT in the current sitemap are flipped to
  // isActive=false. Safer than deleting — preserves operator's custom anchors
  // and history. Default false so a first sync doesn't surprise the user.
  const deactivateMissing = Boolean(body?.deactivateMissing)

  const project = await getOrCreateCurrentProject(userId)

  let xml: string
  try {
    const res = await fetch(sitemapUrl, { headers: { 'User-Agent': 'n5deal-dashboard-sitemap-sync/1.0' } })
    if (!res.ok) {
      return NextResponse.json({ error: `Sitemap fetch failed: ${res.status} ${res.statusText}` }, { status: 502 })
    }
    xml = await res.text()
  } catch (err) {
    return NextResponse.json({ error: `Could not reach sitemap: ${(err as Error).message}` }, { status: 502 })
  }

  const absoluteUrls = parseSitemapXml(xml)
  if (absoluteUrls.length === 0) {
    return NextResponse.json({ error: 'No <loc> entries found in sitemap (is the XML well-formed?)' }, { status: 422 })
  }

  // Derive expected origin from the sitemap URL (so we strip the right prefix)
  let origin: string
  try {
    origin = new URL(sitemapUrl).origin
  } catch {
    return NextResponse.json({ error: 'sitemapUrl is not a valid URL' }, { status: 400 })
  }

  // Convert absolute URLs to relative paths, drop duplicates and off-domain entries.
  const paths = Array.from(new Set(
    absoluteUrls
      .map((u) => toRelativePath(u, origin))
      .filter((p): p is string => Boolean(p)),
  ))

  // Load existing links for this project so we can detect which ones to skip
  // and which to deactivate.
  const existing = await prisma.internalLink.findMany({
    where: { projectId: project.id },
    select: { id: true, url: true, isActive: true },
  })
  const existingByUrl = new Map(existing.map((l) => [l.url, l]))

  const result: SyncResult = {
    total: paths.length,
    created: 0,
    skipped: 0,
    deactivated: 0,
    reactivated: 0,
    details: { created: [], deactivated: [] },
  }

  // Pass 1: create new links from sitemap, skip existing (don't overwrite
  // operator's customised anchors)
  for (const path of paths) {
    const existingRow = existingByUrl.get(path)
    if (existingRow) {
      // If it was previously deactivated and now reappears in sitemap → reactivate.
      if (!existingRow.isActive) {
        await prisma.internalLink.update({ where: { id: existingRow.id }, data: { isActive: true } })
        result.reactivated++
      } else {
        result.skipped++
      }
      continue
    }
    const override = URL_OVERRIDES[path]
    const anchor = override?.anchor ?? deriveAnchorFromPath(path)
    const category = override?.category ?? deriveCategory(path)
    const priority = override?.priority ?? 'nice'
    const anchorAlts = override?.anchorAlts ?? []
    const context = override?.context ?? null
    // Only top-level pages (≤1 path segment) and curated overrides are active
    // by default. Nested URLs (glossary terms, articles, listings) are imported
    // but kept inactive so the per-brief link list stays focused — the operator
    // can activate any of them via the UI when a specific page needs it.
    const segments = path.split('/').filter(Boolean).length
    const isActive = Boolean(override) || segments <= 1
    await prisma.internalLink.create({
      data: {
        projectId: project.id,
        url: path,
        anchor,
        anchorAlts,
        context,
        category,
        priority,
        isActive,
      },
    })
    result.created++
    result.details.created.push(path)
  }

  // Pass 2 (optional): deactivate links no longer in the sitemap.
  if (deactivateMissing) {
    const sitemapSet = new Set(paths)
    for (const row of existing) {
      if (!row.isActive) continue
      // Only consider relative-path entries that look like real site URLs.
      // Skip third-party / external URLs that the operator added manually.
      if (!row.url.startsWith('/')) continue
      if (!sitemapSet.has(row.url)) {
        await prisma.internalLink.update({ where: { id: row.id }, data: { isActive: false } })
        result.deactivated++
        result.details.deactivated.push(row.url)
      }
    }
  }

  return NextResponse.json(result)
}
