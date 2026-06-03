// Deterministic check that the article model output actually obeys the
// system prompt's "banned vocab / compliance / framing" rules. Models
// often glide past these constraints — running a regex sweep after
// generation lets us either auto-refine or surface the misses to the
// operator instead of pretending the output is clean.
//
// Scope notes:
//   - The mandatory disclaimer at the bottom literally contains words on
//     the forbidden list (advice, consult, advisors). We strip it out
//     before scanning so it doesn't generate false positives.
//   - The SEO METADATA / KEYWORD VERIFICATION blocks are excluded for the
//     same reason — they're meta about the article, not the article.

const BANNED_WORDS: readonly string[] = [
  'leverage', 'unlock', 'seamlessly', 'robust', 'game-changer', 'delve',
  'embark', 'elevate', 'embrace', 'myriad', 'plethora', 'tapestry', 'vibrant',
  'indeed', 'additionally', 'essentially', 'comprehensive', 'holistic',
  'dynamic', 'harness', 'pivotal', 'paramount', 'foster', 'cultivate',
  'transformative', 'cutting-edge', 'state-of-the-art', 'ever-evolving',
  'arsenal', 'bolster', 'streamline', 'empower', 'furthermore', 'moreover',
]

// "Navigate" is banned only as a verb about challenges — the bare word is
// flagged separately so the operator can decide; in practice the model
// nearly always uses it in the banned sense.
const BANNED_AMBIGUOUS: readonly string[] = ['navigate', 'realm', 'landscape', 'journey', 'showcase']

const BANNED_PHRASES: readonly string[] = [
  'in conclusion', 'in summary', 'to sum up', 'navigating the complexities',
  'the importance of cannot be overstated', 'stay ahead of the curve',
  'a deep dive into', 'at the forefront', 'as we move forward',
  "in today's fast-paced world", 'the digital age',
]

// Generic article openers — the spec explicitly lists these as forbidden
// for the FIRST paragraph. We only check the first paragraph against them.
const GENERIC_OPENER_PATTERNS: { name: string; re: RegExp }[] = [
  { name: "In today's",         re: /^in today['’]s\b/i },
  { name: 'In an era of',       re: /^in an era of\b/i },
  { name: 'The world of',       re: /^the world of\b/i },
  { name: 'As businesses',      re: /^as businesses\b/i },
  { name: 'Imagine',            re: /^imagine\b/i },
  { name: 'Now more than ever', re: /^now more than ever\b/i },
  { name: 'In the rapidly evolving', re: /^in the rapidly evolving\b/i },
  { name: 'The rise of',        re: /^the rise of\b/i },
  { name: 'More than ever before', re: /^more than ever before\b/i },
  { name: 'In recent years',    re: /^in recent years\b/i },
]

// "We INFORM, not CONSULT" — flag any sentence where N5Deal is positioned
// as an advisor / decider rather than an informational platform.
const ADVISORY_PATTERNS: { name: string; re: RegExp }[] = [
  { name: 'N5Deal advises/recommends/manages/decides', re: /n5deal[^.]{0,40}\b(advises?|recommends?|guarantees?|manages?|decides?|suggests?)\b/gi },
  { name: 'we recommend / we advise / we suggest',     re: /\bwe\s+(recommend|advise|suggest)s?\b/gi },
  { name: 'our recommendation / our advice',           re: /\bour\s+(recommendation|advice)\b/gi },
]

// Forbidden compliance terms — every one of these is a hard "never use"
// per Part 9 of the system prompt. Some have plausible regulator-name
// exceptions ("European Central Bank") so we exclude common proper-noun
// contexts before flagging.
const FORBIDDEN_TERMS: readonly string[] = [
  // Note: 'bank' / 'banking' are caught separately with a proper-noun filter.
  'deposit', 'accept deposits', 'investment advice', 'investment recommendation',
  'we recommend', 'our recommendation', 'we advise', 'advise', 'consult',
  'consultation', 'consulting', 'advisory', 'advisory services',
  'financial advisor', 'financial adviser', 'investment advisor',
  'investment adviser', 'broker', 'brokerage', 'dealer', 'dealing',
  'execute trades', 'fund', 'investment fund', 'asset management',
  'portfolio management', 'discretionary management', 'AUM',
  'assets under management', 'NAV', 'custody', 'custodian',
  'guaranteed', 'guaranteed return', 'guaranteed profit', 'risk-free',
  'no risk', 'safe investment', 'principal protected', 'insurance', 'insured',
  'capital protection', 'wealth management', 'financial planning',
  'retirement planning', 'tax planning', 'tax advice', 'estate planning',
  'fiduciary', 'in your best interest', 'on your behalf', 'entrust your money',
  'IPO', 'shares offering', 'underwriting', 'prospectus', 'securities offering',
  'invest with us', 'invest now', 'start earning today', 'passive income',
  'high return at low risk', 'professional investment management',
  'suitable for you', 'best for your needs', 'personal recommendation',
]

// Regulator names that legitimately contain "bank" / "banking". Anything
// outside these phrases is flagged. Add more as needed.
const PROPER_NOUN_BANK_PATTERNS: RegExp[] = [
  /european central bank/gi,
  /european banking authority/gi,
  /bank of england/gi,
  /federal reserve bank/gi,
  /bank for international settlements/gi,
  /world bank/gi,
  /investment bank(?!ing)/gi, // "investment bank" as proper-noun context (rare)
]

export type ViolationCategory =
  | 'banned_word'
  | 'banned_phrase'
  | 'generic_opener'
  | 'advisory_framing'
  | 'forbidden_term'
  | 'banking_reference'

export interface Violation {
  category: ViolationCategory
  term: string
  count: number
  excerpt: string
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function getExcerpt(text: string, matchIdx: number, matchLen: number): string {
  const start = Math.max(0, matchIdx - 40)
  const end = Math.min(text.length, matchIdx + matchLen + 40)
  const slice = text.slice(start, end).replace(/\s+/g, ' ').trim()
  return (start > 0 ? '…' : '') + slice + (end < text.length ? '…' : '')
}

/**
 * Strip the disclaimer + SEO metadata blocks before scanning so their
 * (mandatory) wording doesn't trigger false positives.
 */
function bodyOnly(text: string): string {
  let cut = text
  // SEO METADATA block
  const seoIdx = cut.search(/^---\s*\n##\s*SEO METADATA/im)
  if (seoIdx > 0) cut = cut.slice(0, seoIdx)
  // Disclaimer line — italicised paragraph starting with "Disclaimer:"
  const discIdx = cut.search(/\*\s*Disclaimer:/i)
  if (discIdx > 0) cut = cut.slice(0, discIdx)
  return cut
}

/**
 * Find the first paragraph of body prose (not the metadata header, not
 * H1, not Key Takeaways). Used to check generic opener rules.
 */
function firstProseParagraph(text: string): string | null {
  const blocks = text.split(/\n{2,}/)
  for (const raw of blocks) {
    const block = raw.trim()
    if (!block) continue
    if (block.startsWith('#')) continue                // headings
    if (block.startsWith('*Reading') || block.startsWith('*Tags')) continue
    if (block.startsWith('**Word Count')) continue
    if (block.startsWith('**Key Takeaways**')) continue
    if (block.startsWith('-') || block.startsWith('*')) continue
    if (block.startsWith('---')) continue
    return block
  }
  return null
}

export function lintArticle(text: string): Violation[] {
  const out: Violation[] = []
  const body = bodyOnly(text)

  // ── banned vocabulary (hard list)
  for (const w of BANNED_WORDS) {
    const re = new RegExp(`\\b${escapeRegex(w)}\\b`, 'gi')
    const matches = [...body.matchAll(re)]
    if (matches.length) {
      out.push({ category: 'banned_word', term: w, count: matches.length, excerpt: getExcerpt(body, matches[0].index ?? 0, matches[0][0].length) })
    }
  }
  // ── banned vocabulary (ambiguous — only when used as verb/figurative)
  for (const w of BANNED_AMBIGUOUS) {
    const re = new RegExp(`\\b${escapeRegex(w)}\\b`, 'gi')
    const matches = [...body.matchAll(re)]
    if (matches.length) {
      out.push({ category: 'banned_word', term: w, count: matches.length, excerpt: getExcerpt(body, matches[0].index ?? 0, matches[0][0].length) })
    }
  }

  // ── banned phrases
  for (const p of BANNED_PHRASES) {
    const re = new RegExp(escapeRegex(p), 'gi')
    const matches = [...body.matchAll(re)]
    if (matches.length) {
      out.push({ category: 'banned_phrase', term: p, count: matches.length, excerpt: getExcerpt(body, matches[0].index ?? 0, matches[0][0].length) })
    }
  }

  // ── generic openers (first paragraph only)
  const first = firstProseParagraph(body)
  if (first) {
    for (const { name, re } of GENERIC_OPENER_PATTERNS) {
      if (re.test(first)) {
        out.push({ category: 'generic_opener', term: name, count: 1, excerpt: first.slice(0, 100) })
      }
    }
  }

  // ── advisory framing
  for (const { name, re } of ADVISORY_PATTERNS) {
    const matches = [...body.matchAll(re)]
    if (matches.length) {
      out.push({ category: 'advisory_framing', term: name, count: matches.length, excerpt: getExcerpt(body, matches[0].index ?? 0, matches[0][0].length) })
    }
  }

  // ── forbidden compliance terms
  for (const t of FORBIDDEN_TERMS) {
    const re = new RegExp(`\\b${escapeRegex(t)}\\b`, 'gi')
    const matches = [...body.matchAll(re)]
    if (matches.length) {
      out.push({ category: 'forbidden_term', term: t, count: matches.length, excerpt: getExcerpt(body, matches[0].index ?? 0, matches[0][0].length) })
    }
  }

  // ── bank / banking with proper-noun filter
  const bankRe = /\bbank(?:s|ing)?\b/gi
  const bankMatches: { idx: number; raw: string }[] = []
  for (const m of body.matchAll(bankRe)) {
    if (m.index == null) continue
    // Skip if this occurrence is inside a known regulator name
    const slice = body.slice(Math.max(0, m.index - 40), m.index + m[0].length + 40)
    const inside = PROPER_NOUN_BANK_PATTERNS.some((p) => p.test(slice))
    if (inside) continue
    bankMatches.push({ idx: m.index, raw: m[0] })
  }
  if (bankMatches.length) {
    out.push({
      category: 'banking_reference',
      term: 'bank / banking',
      count: bankMatches.length,
      excerpt: getExcerpt(body, bankMatches[0].idx, bankMatches[0].raw.length),
    })
  }

  return out
}

/**
 * Produce the operator-facing summary the API surfaces back to the UI.
 * Grouped by category, capped at 30 entries so the toast / drawer stays
 * readable on a 750-word article that completely failed to follow rules.
 */
export function summariseViolations(vs: Violation[]): { total: number; byCategory: Record<ViolationCategory, number>; top: Violation[] } {
  const byCategory = vs.reduce((acc, v) => {
    acc[v.category] = (acc[v.category] ?? 0) + v.count
    return acc
  }, {} as Record<ViolationCategory, number>)
  return { total: vs.reduce((s, v) => s + v.count, 0), byCategory, top: vs.slice(0, 30) }
}
