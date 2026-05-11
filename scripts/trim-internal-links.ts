// One-shot migration: for every GeneratedContent in seed-project-n5deal, trim
// in-body internal links down to the 2-3 most important and most-relevant ones.
//
// Rules:
//  - Treat a markdown link as "internal" if its URL points to n5deal.com (any
//    subdomain/path) or matches one of the briefData.internalLinks entries.
//  - External / citation / market-news links are left untouched.
//  - Keep at most 3 internal links per piece. If more exist, score them:
//      must-priority   = 10
//      nice-priority   = 5
//      unknown (no brief entry) = 1
//      anchor or URL slug overlaps page topic / target audience (+3)
//      contains "buy" / "sell" / "start" CTA verbs (+1) — actionable links
//    Keep top 3 by score. Ties broken by first-appearance order so the flow
//    stays natural.
//  - Stripped links: '[anchor](url)' → 'anchor' (plain text).
//  - If a piece already has ≤ 3 internal links, leave it alone.
//
// Usage:
//   npx tsx --require dotenv/config scripts/trim-internal-links.ts             # local
//   DATABASE_URL="<neon>" npx tsx --require dotenv/config scripts/trim-internal-links.ts

import { prisma } from '../lib/db'

const PROJECT_ID = 'seed-project-n5deal'

interface BriefLink {
  anchor?: string
  url?: string
  priority?: 'must' | 'nice'
  context?: string
}

interface FoundLink {
  anchor: string
  url: string
  startIdx: number
  endIdx: number
  raw: string
  score: number
  priority: 'must' | 'nice' | 'unknown'
}

const LINK_RE = /\[([^\]\n]+)\]\(([^)\s]+)\)/g

function isInternal(url: string, briefLinks: BriefLink[]): boolean {
  if (/n5deal\.com/i.test(url)) return true
  if (briefLinks.some((b) => b.url && b.url === url)) return true
  // Relative paths like /start-buying are also internal
  if (url.startsWith('/')) return true
  return false
}

function scoreLink(found: FoundLink, briefLinks: BriefLink[], topic: string, audience: string): { score: number; priority: 'must' | 'nice' | 'unknown' } {
  const briefEntry = briefLinks.find((b) => b.url === found.url)
  let priority: 'must' | 'nice' | 'unknown' = 'unknown'
  let score = 1
  if (briefEntry?.priority === 'must') { priority = 'must'; score = 10 }
  else if (briefEntry?.priority === 'nice') { priority = 'nice'; score = 5 }

  const haystack = `${found.anchor} ${found.url}`.toLowerCase()
  const topicWords = (topic ?? '').toLowerCase().split(/\W+/).filter((w) => w.length >= 4)
  const audienceWords = (audience ?? '').toLowerCase().split(/\W+/).filter((w) => w.length >= 4)
  if ([...topicWords, ...audienceWords].some((w) => haystack.includes(w))) score += 3
  if (/(buy|sell|start|acquire|valuation|license|license)/.test(haystack)) score += 1

  return { score, priority }
}

function stripLink(body: string, link: FoundLink): string {
  // Replace '[anchor](url)' with just 'anchor' at the exact span.
  return body.slice(0, link.startIdx) + link.anchor + body.slice(link.endIdx)
}

function trimBody(body: string, briefLinks: BriefLink[], topic: string, audience: string): { newBody: string; keptUrls: string[]; strippedUrls: string[] } {
  // Pass 1: find all markdown links in document order.
  const all: FoundLink[] = []
  let m: RegExpExecArray | null
  LINK_RE.lastIndex = 0
  while ((m = LINK_RE.exec(body)) !== null) {
    all.push({
      anchor: m[1],
      url: m[2],
      startIdx: m.index,
      endIdx: m.index + m[0].length,
      raw: m[0],
      score: 0,
      priority: 'unknown',
    })
  }

  // Split into internal vs. external — only trim internals.
  const internals = all.filter((l) => isInternal(l.url, briefLinks))
  if (internals.length <= 3) {
    return { newBody: body, keptUrls: internals.map((l) => l.url), strippedUrls: [] }
  }

  // Score each internal link.
  internals.forEach((l) => {
    const { score, priority } = scoreLink(l, briefLinks, topic, audience)
    l.score = score
    l.priority = priority
  })

  // Pick top 3 by score (stable: ties keep original document order).
  const ranked = internals
    .map((l, idx) => ({ link: l, idx }))
    .sort((a, b) => b.link.score - a.link.score || a.idx - b.idx)
  const keep = new Set(ranked.slice(0, 3).map((r) => r.idx))
  const strip = ranked.slice(3).map((r) => r.link)

  // Strip from RIGHT to LEFT so earlier indices stay valid.
  let out = body
  const stripSorted = [...strip].sort((a, b) => b.startIdx - a.startIdx)
  for (const link of stripSorted) {
    out = stripLink(out, link)
  }

  const keptUrls = ranked.slice(0, 3).map((r) => r.link.url)
  const strippedUrls = strip.map((l) => l.url)
  return { newBody: out, keptUrls, strippedUrls }
}

async function main() {
  const contents = await prisma.generatedContent.findMany({
    where: { projectId: PROJECT_ID },
    select: { id: true, topic: true, targetAudience: true, contentType: true, generatedBrief: true, briefData: true },
  })
  console.log(`Found ${contents.length} generated pieces in project ${PROJECT_ID}\n`)

  let touched = 0
  let untouched = 0
  for (const c of contents) {
    const brief = (c.briefData as any) ?? {}
    const briefLinks: BriefLink[] = Array.isArray(brief?.internalLinks) ? brief.internalLinks : []
    const { newBody, keptUrls, strippedUrls } = trimBody(
      c.generatedBrief ?? '',
      briefLinks,
      c.topic ?? '',
      c.targetAudience ?? '',
    )
    if (newBody === c.generatedBrief) {
      console.log(`  · "${c.topic}" — already ≤ 3 internal links, skipped`)
      untouched++
      continue
    }
    await prisma.generatedContent.update({
      where: { id: c.id },
      data: { generatedBrief: newBody },
    })
    touched++
    console.log(`  ✓ "${c.topic}" — kept ${keptUrls.length}, stripped ${strippedUrls.length}`)
    keptUrls.forEach((u) => console.log(`      kept: ${u}`))
    strippedUrls.forEach((u) => console.log(`      stripped: ${u}`))
  }
  console.log(`\nDone — ${touched} updated, ${untouched} left as-is`)
}

main().catch((e) => { console.error('ERROR:', e?.message ?? e); process.exit(1) }).finally(() => prisma.$disconnect())
