// Shared types for the TZ-style structured content brief.
// Used on both server (API + AI prompt builder) and client (form + output).

export type ContentType = 'article' | 'catalog' | 'linkedin' | 'telegram' | 'press-release'
export type BriefLanguage = 'uk' | 'en' | 'ru'

export interface MainKeyword {
  term: string
  minCount: number
}

export interface StructureBlock {
  heading: string // H2 title
  subtopics: string[] // bulleted subtopics / H3 candidates
  allowSubdivision?: boolean // whether H3s may be used
}

export interface BriefRedFlag {
  word: string
  severity?: 'warn' | 'block'
  reason?: string
}

export interface BriefInternalLink {
  url: string // /buyer OR absolute URL
  anchor: string // primary anchor text suggestion
  anchorAlts?: string[] // alternative phrasings the AI may use
  context?: string // hint where / when to insert
  priority?: 'must' | 'nice'
  source?: 'project' | 'brief' // origin (for UI merge display)
}

export interface BriefData {
  // Page / context
  pageUrl?: string
  icpId?: string | null
  icpIds?: string[]
  language: BriefLanguage

  // Voice / goal
  tone: string // e.g. "Conversational-Professional"
  format: string // e.g. "Q&A style, informative"
  goal: string // what should the reader understand?
  placement?: string // where on the page, optional

  // Technical specs
  wordCountMin?: number
  wordCountMax?: number
  uniqueness?: number // 0..100
  useH2: boolean
  useH3: boolean
  useLists: boolean
  allowHeadingReorder?: boolean
  notes?: string // Постановка задачі — free text

  // Content plan
  structure: StructureBlock[]

  // Keywords
  mainKeywords: MainKeyword[]
  lsiKeywords: string[]

  // Red flags — snapshot at brief time (project-level list can add more)
  redFlags: BriefRedFlag[]

  // Internal linking — AI will be instructed to place these as markdown [anchor](url)
  // in contextually relevant places. Merged with project-level InternalLink library.
  internalLinks: BriefInternalLink[]
}

export function emptyBrief(contentType: ContentType = 'article'): BriefData {
  // Press releases get their own length defaults (operator typically tightens
  // these per release): typical newswire copy lands around 400–700 words,
  // not the 700–1000 page sweet spot.
  const isPressRelease = contentType === 'press-release'
  const isLong = contentType === 'article' || contentType === 'catalog' || isPressRelease
  return {
    pageUrl: '',
    icpId: null,
    language: 'uk',
    tone: 'Conversational-Professional',
    format: isLong ? 'Informative, Q&A friendly' : 'Concise, scroll-stopping',
    goal: '',
    placement: '',
    wordCountMin: isPressRelease ? 400 : isLong ? 700 : 120,
    wordCountMax: isPressRelease ? 700 : isLong ? 1000 : 300,
    uniqueness: 90,
    useH2: isLong,
    useH3: isLong,
    useLists: true,
    allowHeadingReorder: true,
    notes: '',
    structure: isLong
      ? [{ heading: '', subtopics: [''], allowSubdivision: true }]
      : [],
    mainKeywords: [],
    lsiKeywords: [],
    redFlags: [],
    internalLinks: [],
  }
}

// Build the user-facing Markdown prompt that the LLM consumes.
// Keeps formatting very close to the TZ template so the model understands the task.
export function buildBriefPrompt(input: {
  contentType: ContentType
  topic: string
  targetAudience: string
  keyMessages?: string
  brief: BriefData
  icpContext?: string
  mergedRedFlags: BriefRedFlag[]
  mergedInternalLinks: BriefInternalLink[]
  documentContext?: string
  knowledgeBaseContext?: string
}): { system: string; user: string } {
  const { contentType, topic, targetAudience, keyMessages, brief, icpContext, mergedRedFlags, mergedInternalLinks, documentContext, knowledgeBaseContext } = input

  const langLabel = brief.language === 'uk' ? 'Ukrainian' : brief.language === 'ru' ? 'Russian' : 'English'

  const wc =
    brief.wordCountMin && brief.wordCountMax
      ? `${brief.wordCountMin}\u2013${brief.wordCountMax} words`
      : brief.wordCountMin
      ? `at least ${brief.wordCountMin} words`
      : brief.wordCountMax
      ? `at most ${brief.wordCountMax} words`
      : '—'

  const techLines: string[] = [
    `- Length: ${wc}`,
    `- Uniqueness target: ${brief.uniqueness ?? 90}%`,
    `- Language: ${langLabel}`,
    `- Use H2 headings: ${brief.useH2 ? 'yes' : 'no'}`,
    `- Use H3 sub-headings: ${brief.useH3 ? 'yes (when helpful)' : 'no'}`,
    `- Use lists / bullets where appropriate: ${brief.useLists ? 'yes' : 'no'}`,
  ]
  if (brief.allowHeadingReorder) techLines.push('- You MAY reorder H2 blocks if it improves flow.')

  const structureLines =
    brief.structure.length > 0
      ? brief.structure
          .map((b, i) => {
            const subs = (b.subtopics ?? []).filter((s) => s && s.trim())
            const subBlock = subs.length ? `\n  Subtopics to cover:\n${subs.map((s) => `    - ${s}`).join('\n')}` : ''
            const h3 = b.allowSubdivision ? '\n  (H3 subdivision allowed)' : ''
            return `${i + 1}. H2 \u2014 ${b.heading || '(TBD)'}${subBlock}${h3}`
          })
          .join('\n')
      : '(no fixed structure \u2014 model decides)'

  const mainKwLines =
    brief.mainKeywords.length > 0
      ? brief.mainKeywords
          .map((k) => `- "${k.term}" \u2014 use at least ${k.minCount} time${k.minCount === 1 ? '' : 's'} (direct match, do NOT decline)`)
          .join('\n')
      : '(none specified)'

  const lsiLine =
    brief.lsiKeywords.length > 0
      ? brief.lsiKeywords.map((k) => `"${k}"`).join(', ')
      : '(none specified)'

  const redFlagLine =
    mergedRedFlags.length > 0
      ? mergedRedFlags
          .map((r) => {
            const sev = r.severity === 'block' ? ' [BLOCK]' : ''
            const reason = r.reason ? ` — ${r.reason}` : ''
            return `"${r.word}"${sev}${reason}`
          })
          .join(', ')
      : '(none — still avoid obvious AI tell-tale phrases)'

  const internalLinksLines =
    mergedInternalLinks.length > 0
      ? mergedInternalLinks
          .map((l, i) => {
            const priority = l.priority === 'must' ? ' [MUST INSERT]' : ' [insert if natural]'
            const alts =
              l.anchorAlts && l.anchorAlts.length > 0
                ? ` — anchor alternatives: ${l.anchorAlts.map((a) => `"${a}"`).join(', ')}`
                : ''
            const ctx = l.context ? `\n     Context: ${l.context}` : ''
            return `${i + 1}. ${l.url}${priority}\n     Primary anchor: "${l.anchor}"${alts}${ctx}`
          })
          .join('\n')
      : '(no internal links specified — do not add random links)'

  const englishHardLock =
    brief.language === 'en'
      ? ' OUTPUT LANGUAGE: English ONLY. The entire output — every heading, paragraph, bullet, list item, anchor text, table cell, footer block, and even the keyword/links report — MUST be written in English. Do NOT switch language under any circumstance, even if the topic, target audience, key messages, reference document, ICP context, or any keyword is provided in another language. If a non-English term must be referenced, write it in English (translate or transliterate). Never produce a single Ukrainian, Russian, or other-language word in the output.'
      : ''

  const system = `You are a senior SEO copywriter producing structured ${contentType} content for the N5Deal marketing team. You follow a strict technical brief (TZ). You never invent facts; when data is missing, write "TBD". You write in ${langLabel}.${englishHardLock} You optimize for readability, SEO keyword coverage, and for being flagged as HUMAN-written by AI detectors.`

  const formatDirective =
    contentType === 'article' || contentType === 'catalog'
      ? `Deliver the final content as clean Markdown: use H2 (##) and, where helpful, H3 (###). Include short paragraphs, bullet/numbered lists, and internal logic. Do not add preambles or meta commentary — only the article itself.`
      : contentType === 'linkedin'
      ? `Deliver a ready-to-post LinkedIn text. First 2 lines must be a scroll-stopping hook. Use short lines, line breaks, and a single CTA at the end. No hashtag wall — max 3–5 relevant hashtags at the very end.`
      : `Deliver a ready-to-post Telegram channel text. Start with a short emoji hook, keep paragraphs tiny, use bullets (•) where useful, end with a single CTA + link placeholder.`

  const languageBanner =
    brief.language === 'en'
      ? `# OUTPUT LANGUAGE: ENGLISH ONLY\nThe entire output must be in English. Translate any non-English topic / audience / key messages / reference text into English before producing output. Do not include any words in Ukrainian, Russian, or any other language anywhere in the output.\n\n`
      : ''

  const user = `${languageBanner}# Technical Brief (TZ)

## Page / Topic
- Topic: ${topic}
- Page URL: ${brief.pageUrl || '(not specified)'}
- Target audience: ${targetAudience}
- Content type: ${contentType}

## Voice & Goal
- Tone: ${brief.tone || '—'}
- Format: ${brief.format || '—'}
- Goal (what reader must understand): ${brief.goal || '—'}
- On-page placement: ${brief.placement || '—'}
- Key messages: ${keyMessages?.trim() || '(infer sensible ones from the topic)'}

## Technical Requirements
${techLines.join('\n')}
${brief.notes ? `\n## Notes / Task Statement\n${brief.notes}` : ''}

## Required Content Structure
${structureLines}

## Main Keywords (MUST appear in direct match, do NOT change word form)
${mainKwLines}

## Additional LSI Keywords (may be inflected, use most of them)
${lsiLine}

## Red Flag Words — DO NOT USE ANY OF THESE
${redFlagLine}

## Internal Links — embed naturally as Markdown [anchor](url)
${internalLinksLines}

Linking rules:
- Use EXACTLY the URLs listed above. Do NOT invent or alter URLs.
- Place each [MUST INSERT] link at least once, in the most contextually relevant sentence.
- Use the "Primary anchor" as display text when possible; otherwise pick an anchor alternative. Do not create unrelated anchors.
- One link per sentence maximum. Never stack multiple links in a single heading.
- Links must flow with the surrounding prose — if a link cannot be inserted naturally, skip it (unless marked MUST INSERT).

${knowledgeBaseContext ? `\n## Knowledge Base Context (your project's ground truth — use as factual reference, do NOT contradict)\n${knowledgeBaseContext}\n` : ''}${documentContext ? `\n## Reference Document Context\n${documentContext}\n` : ''}
${icpContext ? `\n## Linked ICP Context${icpContext}\n` : ''}

## Output Rules
${formatDirective}
At the VERY END, add a short block named "— Keyword usage report —" where you list each Main Keyword and how many times it was used in the text. Do not bold it, just a plain list.
Also add a second block "— Internal links used —" listing every URL you actually inserted with the anchor text you chose.
`

  return { system, user }
}

// Client-side helper: count how many times a given URL appears inside Markdown-style
// links in the text, i.e. `](url)` or `](url "title")` patterns.
// Also matches bare URL occurrences as a fallback.
export function countLinkOccurrences(text: string, url: string): number {
  if (!text || !url) return 0
  const clean = url.trim()
  if (!clean) return 0
  const escaped = clean.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  // Match `](url)`, `](url "title")`, or `](url#anchor)` — standard markdown link target
  const mdRegex = new RegExp(`\\]\\(\\s*${escaped}[^)]*\\)`, 'giu')
  const mdMatches = text.match(mdRegex)
  if (mdMatches && mdMatches.length > 0) return mdMatches.length
  // Fallback: bare URL appearance (html <a href="..."> or plain url in text)
  const bareRegex = new RegExp(escaped, 'giu')
  const bareMatches = text.match(bareRegex)
  return bareMatches ? bareMatches.length : 0
}

// Client-side helper: given text and a list of red flag words/main-keywords,
// compute how many times each term appears (case-insensitive, whole-word-ish).
export function countTermOccurrences(text: string, term: string): number {
  if (!text || !term) return 0
  const clean = term.trim()
  if (!clean) return 0
  const escaped = clean.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  // allow partial-word boundary using unicode-friendly lookaround alternative
  const regex = new RegExp(escaped, 'giu')
  const matches = text.match(regex)
  return matches ? matches.length : 0
}
