// Deterministic post-processor for LLM-generated page content.
//
// Five rounds of prompt-engineering failed to make the model respect
// MAX keyword counts, link counts, and the metadata header — LLMs are
// bad at counting + obeying numeric ceilings, period. So we enforce
// the constraints in code AFTER generation:
//
//   1. Strip Markdown links to URLs not in the brief whitelist
//   2. Strip duplicate Markdown links (same URL appearing 2+ times)
//   3. Cap primary keyword count by rewriting H2/H3 headings until
//      total count ≤ MAX
//   4. Inject the metadata header (Word Count + Reading Time + Tags)
//      if the model skipped or partially produced it
//
// All passes are idempotent — running twice on already-clean text is a
// no-op. Each fix is logged in `fixes` so the calling route can show
// the operator what was auto-corrected.

export interface PagePostProcessBrief {
  // When `maxCount` is explicitly set (e.g. brief says "CFA license: 5-6"),
  // the post-processor uses it directly — no formula. Otherwise it derives
  // MAX from MIN via keywordMax(). The explicit path is preferred since the
  // brief author knows the SEO target far better than any heuristic.
  primaryKeyword?: { term: string; minCount: number; maxCount?: number }
  secondaryKeywords?: { term: string; minCount: number; maxCount?: number }[]
  lsiKeywords?: string[]
  internalLinks?: { url: string; anchor: string; priority?: 'must' | 'nice' }[]
  topic?: string
}

export interface PagePostProcessResult {
  text: string
  fixes: string[]
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Tight MAX = MIN + ~20% (rounded up), but always at least +1.
// Matches the user's brief format where MIN 5 → MAX 6, MIN 1 → MAX 2, etc.
// Previously we used max(min*2, min+3) which produced MAX=10 for MIN=5 —
// way too loose, allowed the model to write 9× the keyword unchecked.
function keywordMax(min: number): number {
  return Math.max(min + 1, Math.ceil(min * 1.2))
}

// ---------------------------------------------------------------------------
// PASS 1+2 — internal-link normalisation
// ---------------------------------------------------------------------------
function normalizeInternalLinks(
  text: string,
  allowed: { url: string; anchor: string }[],
): { text: string; fixes: string[] } {
  const fixes: string[] = []
  const allowedUrls = new Set(allowed.map((l) => l.url.trim()))
  const seenUrls = new Set<string>()

  const out = text.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, (full, anchor, url) => {
    const cleanUrl = String(url).trim()

    // Pass 1: strip invented URLs (anything not in the brief whitelist).
    // External http(s) URLs are also stripped per system-prompt rule —
    // editors add nofollow externals in the CMS, not the LLM.
    if (!allowedUrls.has(cleanUrl)) {
      fixes.push(`stripped invented/external link: [${anchor}](${cleanUrl})`)
      return String(anchor)
    }

    // Pass 2: strip duplicate links (keep the FIRST occurrence per URL).
    if (seenUrls.has(cleanUrl)) {
      fixes.push(`stripped duplicate link (URL already used): [${anchor}](${cleanUrl})`)
      return String(anchor)
    }

    seenUrls.add(cleanUrl)
    return full
  })

  return { text: out, fixes }
}

// ---------------------------------------------------------------------------
// PASS 3 — cap primary keyword count
// ---------------------------------------------------------------------------
const HEADING_SYNONYMS = [
  'the authorisation',
  'the licence',
  'this authorisation',
  'the licensing framework',
  'this licensing structure',
]

function capPrimaryKeyword(
  text: string,
  keyword: string,
  max: number,
): { text: string; fixes: string[] } {
  const fixes: string[] = []
  const escaped = escapeRegex(keyword)
  const countRegex = new RegExp(escaped, 'gi')
  const totalBefore = (text.match(countRegex) ?? []).length

  if (totalBefore <= max) return { text, fixes }

  let toRemove = totalBefore - max
  const lines = text.split('\n')
  let synIdx = 0
  let firstH2WithKwSkipped = false

  // Match the keyword optionally wrapped in **bold** and optionally preceded
  // by an article (a / an / the). Replacing the whole phrase keeps headings
  // grammatical: "for a CFA license" → "for the authorisation" (not
  // "for a the authorisation").
  const replaceRegex = new RegExp(
    `\\b(?:a|an|the)\\s+\\*{0,2}${escaped}\\*{0,2}|\\*{0,2}${escaped}\\*{0,2}`,
    'gi',
  )

  // Strategy: replace in H3 first (lower importance), then H2 (skip the
  // first H2 that contains the keyword — that's the canonical "What is X"
  // section the brief wants to keep). H1 is never touched.

  // ── H3 pass ──
  for (let i = 0; i < lines.length && toRemove > 0; i++) {
    if (!lines[i].startsWith('### ')) continue
    const before = (lines[i].match(countRegex) ?? []).length
    if (before === 0) continue
    const syn = HEADING_SYNONYMS[synIdx % HEADING_SYNONYMS.length]
    synIdx++
    lines[i] = lines[i].replace(replaceRegex, syn)
    const after = (lines[i].match(countRegex) ?? []).length
    const removed = before - after
    toRemove -= removed
    if (removed > 0) fixes.push(`H3 rewrite (removed ${removed}× "${keyword}"): "${lines[i].slice(0, 70).trim()}…"`)
  }

  // ── H2 pass — skip the FIRST H2 containing the keyword ──
  for (let i = 0; i < lines.length && toRemove > 0; i++) {
    if (!lines[i].startsWith('## ')) continue
    const before = (lines[i].match(countRegex) ?? []).length
    if (before === 0) continue
    if (!firstH2WithKwSkipped) {
      firstH2WithKwSkipped = true
      continue
    }
    const syn = HEADING_SYNONYMS[synIdx % HEADING_SYNONYMS.length]
    synIdx++
    lines[i] = lines[i].replace(replaceRegex, syn)
    const after = (lines[i].match(countRegex) ?? []).length
    const removed = before - after
    toRemove -= removed
    if (removed > 0) fixes.push(`H2 rewrite (removed ${removed}× "${keyword}"): "${lines[i].slice(0, 70).trim()}…"`)
  }

  const out = lines.join('\n')
  const totalAfter = (out.match(countRegex) ?? []).length

  if (totalAfter > max) {
    fixes.push(`WARNING: "${keyword}" still ${totalAfter}× after heading rewrites (target ≤${max}). Body occurrences not auto-reduced — flag for manual edit.`)
  } else {
    fixes.push(`"${keyword}" count: ${totalBefore} → ${totalAfter} (max ${max})`)
  }

  return { text: out, fixes }
}

// ---------------------------------------------------------------------------
// PASS 4 — inject metadata header if missing
// ---------------------------------------------------------------------------
function ensureMetadataHeader(text: string, brief: PagePostProcessBrief): { text: string; fixes: string[] } {
  const fixes: string[] = []

  // Strip any existing partial metadata lines from the very top (if model
  // emitted only Word Count but skipped Reading Time + Tags, we rewrite
  // the whole 3-line block).
  const lines = text.split('\n')
  let firstContentIdx = 0
  while (firstContentIdx < lines.length && lines[firstContentIdx].trim() === '') firstContentIdx++

  const l1 = lines[firstContentIdx] ?? ''
  const l2 = lines[firstContentIdx + 1] ?? ''
  const l3 = lines[firstContentIdx + 2] ?? ''
  const hasWordCount = /^\*\*Word Count:\*\*/i.test(l1)
  const hasReadingTime = /^\*Reading Time:/i.test(l2)
  const hasTags = /^\*Tags:/i.test(l3)
  if (hasWordCount && hasReadingTime && hasTags) return { text, fixes }

  // Build a "body view" for counting words — drop everything from the
  // SEO METADATA appendix down so word count reflects readable prose only.
  const seoIdx = text.indexOf('## SEO METADATA')
  const bodySlice = seoIdx > 0 ? text.slice(0, seoIdx) : text
  const cleanForCount = bodySlice
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*_`#>|]/g, ' ')
    .replace(/\s+/g, ' ')
  const wordCount = cleanForCount.split(' ').filter(Boolean).length
  const readingTime = Math.max(3, Math.round(wordCount / 200))

  // Derive 5 tags from secondary + LSI + topic. We deliberately exclude
  // the primary keyword from tags — otherwise it gets counted toward the
  // MAX-occurrence cap downstream and inflates the page's keyword count
  // beyond what was generated in the body.
  const pool: string[] = []
  for (const s of brief.secondaryKeywords ?? []) if (s.term) pool.push(s.term)
  for (const k of brief.lsiKeywords ?? []) if (k) pool.push(k)
  // Dedupe (case-insensitive)
  const seen = new Set<string>()
  const tags: string[] = []
  for (const t of pool) {
    const key = t.toLowerCase().trim()
    if (key && !seen.has(key)) {
      seen.add(key)
      tags.push(t.trim())
    }
    if (tags.length >= 5) break
  }
  if (tags.length < 5 && brief.topic) {
    const t = brief.topic.trim()
    if (t && !seen.has(t.toLowerCase())) { seen.add(t.toLowerCase()); tags.push(t) }
  }
  // Pad with generic fallbacks, deduped, so we always emit exactly 5 tags.
  const fallbacks = ['fintech licensing', 'regulatory compliance', 'jurisdiction selection', 'business setup', 'legal framework']
  for (const fb of fallbacks) {
    if (tags.length >= 5) break
    if (!seen.has(fb.toLowerCase())) { seen.add(fb.toLowerCase()); tags.push(fb) }
  }

  // Strip any existing metadata-ish lines from the top before re-inserting,
  // so we don't end up with two Word Count lines.
  let cursor = firstContentIdx
  while (cursor < lines.length) {
    const l = lines[cursor]
    if (
      /^\*\*Word Count:\*\*/i.test(l) ||
      /^\*Reading Time:/i.test(l) ||
      /^\*Tags:/i.test(l) ||
      l.trim() === ''
    ) {
      cursor++
    } else {
      break
    }
  }

  const header = [
    `**Word Count:** ${wordCount} words`,
    `*Reading Time: ${readingTime} minutes*`,
    `*Tags: ${tags.slice(0, 5).join(', ')}*`,
    '',
  ]

  const rebuilt = [...header, ...lines.slice(cursor)].join('\n')
  fixes.push(`injected metadata header (${wordCount} words, ${readingTime} min, ${tags.length} tags) — model had skipped it`)
  return { text: rebuilt, fixes }
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------
export function postProcessPage(
  text: string,
  brief: PagePostProcessBrief,
): PagePostProcessResult {
  let out = text
  const fixes: string[] = []

  // Order matters:
  // 1. Link normalisation first — changes word count via dropped link markup.
  // 2. Metadata header injection — uses final word count of cleaned body.
  // 3. Keyword cap LAST — counts the full final document (including any
  //    primary-keyword occurrences picked up by the metadata header), so
  //    the MAX limit is honoured on the document the user actually sees.

  const linkPass = normalizeInternalLinks(out, brief.internalLinks ?? [])
  out = linkPass.text
  fixes.push(...linkPass.fixes)

  const metaPass = ensureMetadataHeader(out, brief)
  out = metaPass.text
  fixes.push(...metaPass.fixes)

  if (brief.primaryKeyword?.term && brief.primaryKeyword.minCount > 0) {
    // Prefer the brief's explicit maxCount when present (e.g. brief says
    // "5-6 times" → MAX=6). Fall back to the heuristic formula only when
    // the brief gave just a MIN.
    const max = brief.primaryKeyword.maxCount && brief.primaryKeyword.maxCount > 0
      ? brief.primaryKeyword.maxCount
      : keywordMax(brief.primaryKeyword.minCount)
    const kwPass = capPrimaryKeyword(out, brief.primaryKeyword.term, max)
    out = kwPass.text
    fixes.push(...kwPass.fixes)
  }

  // Report any MUST-priority internal links that the LLM forgot. We can't
  // safely auto-inject them (placement requires editorial judgement) but the
  // operator should see the warning and add via Request edit.
  const mustLinks = (brief.internalLinks ?? []).filter((l) => l.priority === 'must')
  for (const l of mustLinks) {
    const escapedUrl = escapeRegex(l.url)
    const present = new RegExp(`\\]\\(${escapedUrl}\\)`).test(out)
    if (!present) {
      fixes.push(`WARNING: MUST link missing from output — [${l.anchor}](${l.url}). Add manually via Request edit.`)
    }
  }

  return { text: out, fixes }
}
