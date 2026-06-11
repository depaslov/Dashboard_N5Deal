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
  internalLinks?: { url: string; anchor: string; anchorAlts?: string[]; priority?: 'must' | 'nice' }[]
  topic?: string
}

export interface PagePostProcessResult {
  text: string
  fixes: string[]
}

// Coverage report — used by the generate route to decide whether a second
// LLM pass is needed to weave missing keywords in. Counts are case-
// insensitive substring counts so plural / declined forms still register.
export interface KeywordCoverage {
  /** Primary + secondary keywords that fell SHORT of their minCount target. */
  underMain: { term: string; have: number; want: number }[]
  /** LSI keywords with zero occurrences. */
  missingLsi: string[]
  /** Convenience: true when nothing is missing. */
  allCovered: boolean
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
// PASS 1 — STRICT internal-link enforcement (exactly the TZ set)
//
// Guarantees the final page contains PRECISELY the links from the brief —
// no more, no less, each exactly once, with the brief's anchor text verbatim:
//   - any link whose URL is NOT in the brief → stripped (markup removed, text kept)
//   - any duplicate of a brief URL → stripped (keep first occurrence)
//   - a kept brief link whose anchor differs from the brief → anchor corrected
//   - any brief link MISSING from the output → injected:
//       * first try to linkify an existing plain-text mention of the anchor
//       * else append a "See also:" reference line before the disclaimer
//
// When the brief specifies NO links, we leave the text untouched (there is no
// whitelist to enforce, so we don't strip anything).
// ---------------------------------------------------------------------------
// Builds a series of progressively-looser regex matchers for the same
// anchor, so that small wording / formatting drift in the LLM output
// (singular ↔ plural, hyphen ↔ space, smart-quote vs straight, "the FCA"
// vs "FCA", etc.) doesn't leave the link missing from the page. Variants
// are tried in order — the first one that hits wins.
function buildMatchers(anchor: string, anchorAlts: string[]): Array<{ label: string; re: RegExp }> {
  const candidates = [anchor, ...anchorAlts].map((s) => s.trim()).filter(Boolean)
  const seen = new Set<string>()
  const out: Array<{ label: string; re: RegExp }> = []

  for (const cand of candidates) {
    // (1) verbatim — fastest, safest. Case-insensitive only.
    if (!seen.has(`v:${cand}`)) {
      out.push({ label: `verbatim "${cand}"`, re: new RegExp(escapeRegex(cand), 'i') })
      seen.add(`v:${cand}`)
    }

    // (2) flexible whitespace + punctuation between words. Catches
    // "asset-referenced tokens" vs "asset referenced tokens" vs
    // "asset referenced tokens" (non-breaking space), curly
    // apostrophes, etc.
    const flexible = cand
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => escapeRegex(w))
      .join('[\\s\\-\\u00a0‐-―]+') // any whitespace/dash/NBSP between words
    if (!seen.has(`f:${flexible}`) && flexible !== escapeRegex(cand)) {
      out.push({ label: `flex-ws "${cand}"`, re: new RegExp(flexible, 'i') })
      seen.add(`f:${flexible}`)
    }

    // (3) plural-tolerant variant on the LAST word. "MiCA licence" → also
    // matches "MiCA licences". Conservative: only allows a single trailing
    // "s" or "es", so we don't over-match.
    const words = cand.split(/\s+/).filter(Boolean)
    if (words.length > 0) {
      const last = words[words.length - 1]
      if (!/[s]$/i.test(last)) {
        const pluralPattern = words
          .slice(0, -1)
          .map(escapeRegex)
          .concat(`${escapeRegex(last)}(?:e?s)?`)
          .join('[\\s\\-\\u00a0‐-―]+')
        if (!seen.has(`p:${pluralPattern}`)) {
          out.push({ label: `plural "${cand}"`, re: new RegExp(pluralPattern, 'i') })
          seen.add(`p:${pluralPattern}`)
        }
      }
    }
  }

  return out
}

function linkifyFirstOccurrence(
  text: string,
  anchor: string,
  url: string,
  anchorAlts: string[] = [],
): { text: string; done: boolean; matchedBy?: string } {
  const matchers = buildMatchers(anchor, anchorAlts)
  const lines = text.split('\n')
  for (const matcher of matchers) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (line.startsWith('#')) continue                          // skip headings
      if (/^\*\*Word Count|^\*Reading Time|^\*Tags/i.test(line)) continue // skip metadata header
      if (/^\*This page is for informational/i.test(line)) continue       // skip disclaimer
      const m = line.match(matcher.re)
      if (!m || m.index === undefined) continue
      const idx = m.index
      // Don't linkify text that's already inside a markdown link: [anchor](...)
      const before = line.slice(Math.max(0, idx - 1), idx)
      const after = line.slice(idx + m[0].length)
      if (before === '[' && after.startsWith('](')) continue
      // Wrap the EXACT matched substring (m[0]) — preserves capitalisation /
      // hyphen / plural form from the body so the page reads naturally.
      // The brief anchor is kept only when the matcher was the verbatim one.
      const linkText = matcher.label.startsWith('verbatim') ? anchor : m[0]
      lines[i] = line.slice(0, idx) + `[${linkText}](${url})` + line.slice(idx + m[0].length)
      return { text: lines.join('\n'), done: true, matchedBy: matcher.label }
    }
  }
  return { text, done: false }
}

function appendRelatedLinks(text: string, links: { url: string; anchor: string }[]): string {
  const refs = links.map((l) => `[${l.anchor}](${l.url})`).join(', ')
  const block = `**See also:** ${refs}`
  // Insert before the disclaimer if present, else before the SEO METADATA
  // appendix, else at the very end.
  const discIdx = text.search(/\*This page is for informational/i)
  if (discIdx > 0) {
    return text.slice(0, discIdx).replace(/\s+$/, '') + `\n\n${block}\n\n` + text.slice(discIdx)
  }
  const seoIdx = text.indexOf('## SEO METADATA')
  if (seoIdx > 0) {
    return text.slice(0, seoIdx).replace(/\s+$/, '') + `\n\n${block}\n\n` + text.slice(seoIdx)
  }
  return text.replace(/\s+$/, '') + `\n\n${block}\n`
}

function enforceExactLinks(
  text: string,
  required: { url: string; anchor: string; anchorAlts?: string[] }[],
): { text: string; fixes: string[] } {
  const fixes: string[] = []
  // No TZ links → nothing to enforce against; leave links as the model wrote them.
  if (required.length === 0) return { text, fixes }

  const byUrl = new Map(required.map((l) => [l.url.trim(), l.anchor.trim()]))
  const allowedUrls = new Set(byUrl.keys())
  const seenUrls = new Set<string>()

  // Pass 1: walk existing links — strip non-brief + duplicates, force anchor verbatim.
  let out = text.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, (full, anchor, url) => {
    const cleanUrl = String(url).trim()
    if (!allowedUrls.has(cleanUrl)) {
      fixes.push(`stripped link not in TZ: [${anchor}](${cleanUrl})`)
      return String(anchor)
    }
    if (seenUrls.has(cleanUrl)) {
      fixes.push(`stripped duplicate TZ link: [${anchor}](${cleanUrl})`)
      return String(anchor)
    }
    seenUrls.add(cleanUrl)
    const wantAnchor = byUrl.get(cleanUrl)!
    if (anchor !== wantAnchor) {
      fixes.push(`anchor corrected to TZ: "${anchor}" → "${wantAnchor}"`)
      return `[${wantAnchor}](${cleanUrl})`
    }
    return full
  })

  // Pass 2: inject any TZ link still missing. We pass anchorAlts to the
  // linkifier so close-but-not-verbatim wording in the LLM output (plural,
  // hyphen swap, etc.) still gets caught instead of falling through to
  // the See-also appendix.
  const toAppend: { url: string; anchor: string }[] = []
  for (const l of required) {
    const url = l.url.trim()
    if (seenUrls.has(url)) continue
    const anchor = l.anchor.trim()
    const alts = (l.anchorAlts ?? []).map((a) => a.trim()).filter(Boolean)
    const res = linkifyFirstOccurrence(out, anchor, url, alts)
    if (res.done) {
      out = res.text
      seenUrls.add(url)
      const how = res.matchedBy ? ` via ${res.matchedBy}` : ''
      fixes.push(`injected missing TZ link${how} for "${anchor}"`)
    } else {
      toAppend.push({ url, anchor })
    }
  }
  if (toAppend.length > 0) {
    out = appendRelatedLinks(out, toAppend)
    for (const l of toAppend) {
      seenUrls.add(l.url)
      fixes.push(`injected missing TZ link "${l.anchor}" as a See-also reference (phrase not found in body)`)
    }
  }

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
// Keyword coverage analyzer — counts each main / LSI keyword in the body,
// returns the ones that fell short of their target so the generate route
// can run a second LLM pass to weave them in naturally. Pure / no side
// effects — safe to run independently of postProcessPage.
//
// IMPORTANT: counts use a substring match (case-insensitive) rather than
// strict word boundaries because keywords routinely show up in inflected
// forms (e.g. "EMI licence" / "EMI licences") that a `\b` match would
// miss. Substring matching can over-count when the keyword is a fragment
// of a longer word — we accept that as the lesser evil; the generate
// pipeline cares about "is this keyword visibly present" more than "is
// it grammatically isolated".
// ---------------------------------------------------------------------------
export function analyzeKeywordCoverage(
  text: string,
  brief: PagePostProcessBrief,
): KeywordCoverage {
  function countOf(term: string): number {
    if (!term) return 0
    const m = text.match(new RegExp(escapeRegex(term), 'gi'))
    return m?.length ?? 0
  }

  const underMain: { term: string; have: number; want: number }[] = []

  if (brief.primaryKeyword?.term && brief.primaryKeyword.minCount > 0) {
    const have = countOf(brief.primaryKeyword.term)
    if (have < brief.primaryKeyword.minCount) {
      underMain.push({ term: brief.primaryKeyword.term, have, want: brief.primaryKeyword.minCount })
    }
  }
  for (const k of brief.secondaryKeywords ?? []) {
    if (!k?.term || (k.minCount ?? 0) <= 0) continue
    const have = countOf(k.term)
    if (have < k.minCount) underMain.push({ term: k.term, have, want: k.minCount })
  }

  const missingLsi: string[] = []
  for (const term of brief.lsiKeywords ?? []) {
    if (!term) continue
    if (countOf(term) === 0) missingLsi.push(term)
  }

  return {
    underMain,
    missingLsi,
    allCovered: underMain.length === 0 && missingLsi.length === 0,
  }
}

// Builds the prompt the generate route sends to the LLM on the second
// pass to fill keyword gaps. Centralised here so the wording stays in
// lock-step with what the analyzer is checking — instructions explicitly
// reference the counts and require the keyword in CONTEXT (no header-
// stuffing, no parenthetical lists).
export function buildKeywordTopUpPrompt(
  draft: string,
  coverage: KeywordCoverage,
): string {
  const underLines = coverage.underMain
    .map((u) => `  • "${u.term}" — currently ${u.have} occurrence${u.have === 1 ? '' : 's'}, needs ${u.want}`)
    .join('\n')
  const missingLines = coverage.missingLsi
    .map((t) => `  • "${t}" — currently absent, needs to appear at least once`)
    .join('\n')

  return `The page below is structurally fine but is MISSING these keyword targets from the brief. Rewrite the page so each missing or under-used keyword appears as required, woven into a sentence that makes semantic sense. Do NOT keyword-stuff. Each insertion must be a natural part of the sentence around it.

UNDER-COUNT MAIN KEYWORDS (substring match, case-insensitive):
${underLines || '  (none)'}

MISSING LSI / SECONDARY KEYWORDS:
${missingLines || '  (none)'}

NON-NEGOTIABLE RULES:
1. Preserve EVERY existing internal link \`[anchor](url)\` exactly as written.
2. Preserve EVERY existing H1 / H2 / H3 / H4 heading text. You may add a sentence inside an existing section, but DO NOT add, remove, or rename headings.
3. Preserve the SEO METADATA block at the end verbatim.
4. Preserve the disclaimer (any line starting with "*This page is for informational").
5. Preserve the metadata header (Word Count / Reading Time / Tags) at the top.
6. NO keyword stuffing — sentences like "EMI licence EMI licence is important for EMI licence" are WORSE than the original output. Refuse those.
7. NO parenthetical keyword dumps — "the licence (also known as: X, Y, Z)" is keyword-stuffing in a trench coat. Refuse those too.
8. Each missing keyword goes into a sentence where it would NATURALLY belong — a comparison, a clarification, a real-world example, or a follow-on question.
9. Output the FULL rewritten page in markdown — no preamble, no closing notes, no \`\`\` fences. Same length range as the input.

────── DRAFT ──────

${draft}`
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

  const linkPass = enforceExactLinks(out, brief.internalLinks ?? [])
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

  // Final safety net: confirm every brief link is now present exactly once.
  // enforceExactLinks should have guaranteed this; this just surfaces a clear
  // line in the fixes log for the operator + flags the rare unrecoverable case.
  for (const l of (brief.internalLinks ?? [])) {
    const escapedUrl = escapeRegex(l.url.trim())
    const count = (out.match(new RegExp(`\\]\\(${escapedUrl}\\)`, 'g')) ?? []).length
    if (count === 1) continue
    if (count === 0) fixes.push(`WARNING: TZ link still missing after enforcement — [${l.anchor}](${l.url})`)
    else fixes.push(`WARNING: TZ link appears ${count}× after enforcement — [${l.anchor}](${l.url})`)
  }

  return { text: out, fixes }
}
