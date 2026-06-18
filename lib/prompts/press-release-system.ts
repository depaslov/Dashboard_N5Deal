// Press-release generation system. Same architecture as
// lib/prompts/page-system-v3.ts so the operator brief flow (keywords with
// MIN/MAX, MUST internal links with verbatim anchors, knowledge-base context)
// works identically — only the OUTPUT FORMAT changes. Press releases are
// flatter, journalistic, AP-Style: headline → dateline → lead → body →
// quote(s) → boilerplate → media contact, no H2/H3 hierarchy like a page.
//
// PAID DISTRIBUTION REQUIREMENTS (from operator brief, baked in as hard gates):
//   1. Title length ≤ 116 characters (including spaces).
//   2. Body word count ≤ 500 words (excluding ad label + metadata + contact).
//   3. EXACTLY 2 internal links. Publisher will close them from indexing via
//      `rel="nofollow"` attributes or redirect URLs — copy must read naturally
//      either way (anchor phrases must work as plain prose if the link is
//      stripped or rewritten through a redirector).
//   4. Ad label disclosure at the top of the body, language-localised:
//      "Advertisement" (en) / "На правах реклами" (uk) / "На правах рекламы" (ru).
//   5. Article title is NOT shown on the publisher's homepage — this is a
//      publisher CMS flag the operator sets at distribution time; no body
//      change required but surfaced as a postFix note for the operator.
// These limits work for paid wires AND free aggregators — the paid bar is
// the strict one; free distribution accepts the same copy.

export const PRESS_RELEASE_SYSTEM_PROMPT_V1 = `You are a senior press-release writer producing AP Style newswire copy for the N5Deal marketing team. Your output is fit for distribution on paid wires (PRNewswire, BusinessWire, GlobeNewswire) AND free aggregators / industry blogs — the format below works for both.

You write as a journalist would, NOT as a marketer:
- Third-person voice throughout.
- Past or present tense, not future ("announced today" / "today announces" — never "will announce").
- Facts before claims. No superlatives ("best", "leading", "world-class", "revolutionary", "unique") unless directly supported in the brief.
- No exclamation marks anywhere in the body. No emoji. No marketing buzzwords.
- Short paragraphs (1–3 sentences each). One idea per paragraph.
- Quote a real person with a real title — generate the quote in the company's voice based on the brief, and attribute it as: "quote text," said FirstName LastName, Title at Company. If the brief / knowledge base provides a real spokesperson name, use that; otherwise default to a senior executive title (e.g. "CEO and founder") with a plausible name pattern matching the brand.
- Boilerplate ("About [Company]") goes verbatim from the knowledge-base context when present. If KB context contains an "About N5Deal" block, copy it character-for-character at the end. If no KB boilerplate is available, write a neutral one-paragraph factual description based on the brief — no marketing language.
- End the release with "###" centred on its own line (traditional newswire end mark) after the Media Contact block.

PAID-DISTRIBUTION HARD LIMITS (publisher requirements — never relax these):
- Title: ≤ 116 characters INCLUDING SPACES. Count characters, not words.
- Body word count: ≤ 500 words total (everything from the ad label to "###" combined; the metadata header and KEYWORD VERIFICATION appendix do not count).
- Internal links: EXACTLY 2. Not 1, not 3. The publisher closes both from indexing via \`rel="nofollow"\` attributes or redirect URLs — your copy must read naturally either way (anchor phrases must work as ordinary prose if the link is stripped or rewritten through a redirector).
- Ad label: insert the literal advertising disclosure (language-specific) as the FIRST visible content line after the metadata header, before the headline. Format below.

You follow strict technical briefs. You never invent facts about deals, partners, dollar amounts, or licenses that aren't in the brief / KB context. When unsure, write "TBD" and move on — the operator fills it in.

You are paid to write press releases that READ like third-party journalism, not company marketing. If your output sounds like an ad, rewrite it.`

// ---------------------------------------------------------------------------
// USER-PROMPT BUILDER
//
// Mirrors buildPageUserPrompt in shape so the same brief inputs flow through.
// Differences from pages:
//   1. Mandatory output skeleton is PR-formatted (no H2/H3 hierarchy)
//   2. Keyword MAX is tighter (PRs are short — overuse is more obvious)
//   3. Internal links are softer — wires often strip them, so the prompt
//      asks for plain-text anchor as fallback
//   4. Structure[] is repurposed as "story beats" the model walks in order
//   5. KB context block has a specific "About [Company]" extraction hint
// ---------------------------------------------------------------------------

export interface PressReleaseUserPromptInput {
  topic: string
  targetAudience: string
  keyMessages?: string
  language?: 'en' | 'uk' | 'ru'
  wordCountMin?: number
  wordCountMax?: number
  mainKeywords?: { term: string; minCount: number; maxCount?: number }[]
  lsiKeywords?: string[]
  internalLinks?: { url: string; anchor: string; anchorAlts?: string[]; priority?: 'must' | 'nice'; context?: string }[]
  // structure[] reinterpreted as the story beats / paragraph map for the PR.
  // Each heading becomes a paragraph theme rather than an H2.
  structure?: { heading: string; subtopics?: string[] }[]
  knowledgeBaseContext?: string
  documentContext?: string
  icpContext?: string
  redFlags?: { word: string; severity?: 'block' | 'warn'; reason?: string }[]
  notes?: string
  // Revise-only inputs
  currentContent?: string
  revisionInstructions?: string
  revisionMode?: 'regenerate' | 'edit'
}

// Same formula as page-system-v3 so the post-processor cap matches what the
// prompt promises. Press releases use this cap too — over-stuffed keywords
// are MORE obvious in short PR copy than in a 900-word page.
function keywordMax(min: number): number {
  return Math.max(min + 1, Math.ceil(min * 1.2))
}

// Paid-distribution publisher hard limits — kept as named constants so the
// prompt body, the per-block reminders, and the pre-output checklist all
// reference the same numbers. If a publisher relaxes these, change here.
const TITLE_MAX_CHARS = 116
const BODY_MAX_WORDS = 500
const REQUIRED_INTERNAL_LINK_COUNT = 2

// Language-localised advertising disclosure label, inserted as the first
// visible content line of the release body. Required by paid distribution
// channels in the operator's market — the publisher will render this
// label visibly above the article on the published page.
function adLabel(language: 'en' | 'uk' | 'ru'): string {
  if (language === 'uk') return 'На правах реклами'
  if (language === 'ru') return 'На правах рекламы'
  return 'Advertisement'
}

export function buildPressReleaseUserPrompt(input: PressReleaseUserPromptInput): string {
  // The publisher caps body at 500 words; honour any tighter operator brief
  // but never let the upper bound drift past the publisher limit.
  const wcMin = input.wordCountMin ?? 300
  const wcMax = Math.min(input.wordCountMax ?? BODY_MAX_WORDS, BODY_MAX_WORDS)
  const language = input.language ?? 'en'
  const primary = input.mainKeywords?.[0]
  const secondaries = (input.mainKeywords ?? []).slice(1)
  const isRevise = Boolean(input.currentContent)
  const label = adLabel(language)

  const lines: string[] = []

  // ── BLOCK 1: Output skeleton (mandatory shape, literal template)
  lines.push(`# YOUR OUTPUT SKELETON — literal AP Style press release

Produce the press release in this EXACT order. The first three lines are a metadata header (kept consistent with the rest of the content system); everything after is the press release body itself.

\`\`\`
**Word Count:** N words
*Reading Time: X minutes*
*Tags: tag1, tag2, tag3, tag4, tag5*

**${label}**

# [HEADLINE — ≤ ${TITLE_MAX_CHARS} characters INCLUDING SPACES, no period at end, sentence-case, contains the primary keyword]

*[Subhead — one italic sentence summarising the news, ≤ 25 words]*

**[CITY, COUNTRY — Month D, YYYY]** — [Lead paragraph: 2–3 sentences answering Who / What / When / Where / Why in plain language. The first sentence MUST include the primary keyword and the company name. No marketing fluff.]

[Body paragraph 1 — 2–4 sentences expanding on the WHAT and the immediate WHY-IT-MATTERS. Facts, not claims.]

[Body paragraph 2 — 2–4 sentences with the broader context, the market or regulatory backdrop, or the secondary news beats from the brief.]

"[Quote 1 — one to two sentences, in the company's voice, sounds like a human said it out loud, NOT a marketing line]," said [FirstName LastName], [Title] at [Company].

[Body paragraph 3 — what happens next, who is affected, optional second quote, or a concrete proof-point.]

["[Optional Quote 2]," said [FirstName LastName], [Title] at [Partner / Customer].]

## About [Company]

[Company boilerplate — COPY VERBATIM from the knowledge-base context's "About [Company]" block if present. If not present, write one factual paragraph using only details that appear in the brief / KB.]

## Media Contact

[Name]
[Title]
[Company]
[email@company.com]
[+phone]

###
\`\`\`

- N = total body word count from the ad-label line through the closing \`###\` mark INCLUDING headline, subhead, dateline, quotes, boilerplate, contact block. Target ${wcMin}–${wcMax}. HARD CEILING: ${BODY_MAX_WORDS} words. The metadata header (Word Count / Reading Time / Tags) and the KEYWORD VERIFICATION appendix do NOT count toward the body.
- X = round(N / 200), minimum 2.
- 5 tags = specific to this release (e.g. "${primary?.term ?? 'primary keyword'}, jurisdiction, regulator, announcement type, market"). Never generic.
- The ad label \`**${label}**\` is REQUIRED as the first visible body line (before the headline). Do NOT omit it; do NOT translate it to something else.
- HEADLINE: count the FULL string length including every space, comma, dash, colon, parenthesis. Cap is ${TITLE_MAX_CHARS} characters. A 117-character headline is REJECTED.
- The literal sequence \`###\` on its own line is the traditional newswire end mark. Include it.

If your first output line is anything other than \`**Word Count:**\` — the output is REJECTED.`)

  // ── BLOCK 2: Keyword MIN/MAX enforcement (same machinery as pages)
  if (primary) {
    const rows: string[] = []
    rows.push(`| Keyword | MIN | MAX | Bold | Notes |`)
    rows.push(`|---|---|---|---|---|`)
    const primaryMax = primary.maxCount && primary.maxCount > 0 ? primary.maxCount : keywordMax(primary.minCount)
    rows.push(`| **${primary.term}** (primary) | ${primary.minCount} | ${primaryMax} | NO bold in PR body | Headline (mandatory) + lead paragraph (mandatory) + at most 2 body uses. Press releases overuse-flag faster than pages — stay close to MIN. |`)
    for (const k of secondaries) {
      const kMax = k.maxCount && k.maxCount > 0 ? k.maxCount : keywordMax(k.minCount)
      rows.push(`| ${k.term} | ${k.minCount} | ${kMax} | no bold | within MIN–MAX, prefer body over quote |`)
    }

    lines.push(`# KEYWORD ENFORCEMENT — counts verified before output

${rows.join('\n')}

RULES (apply mechanically, not stylistically):
- Count every occurrence including headline, subhead, dateline, lead, body, quotes, boilerplate, contact block. Case-insensitive.
- Press releases do NOT bold keywords. Bolding is a marketing tell — kills the journalistic voice. The only bold in the body is the \`**[CITY, COUNTRY — Date]**\` dateline.
- Any keyword over MAX → REMOVE occurrences from later body paragraphs first, then second quote, never from the headline or lead.
- Any keyword under MIN → ADD one natural occurrence in a body paragraph (never in a quote — quotes must sound human).
- All secondary keywords listed must each appear AT LEAST once in the body. LSI terms below should appear AT LEAST once between them across the release.

NON-NEGOTIABLE: KEYWORDS MUST READ NATURALLY IN A NEWS CONTEXT.
- A keyword counts ONLY when it appears in a sentence whose meaning depends on it. "The company secured an EMI licence" counts. "The EMI licence is an EMI licence (EMI licence)" does NOT — that is keyword-stuffing and the output is rejected.
- NO parenthetical keyword dumps. "the licence (also called EMI authorisation / EMI permit / electronic money permission)" is stuffing in a trench coat — refuse. Use those terms in DIFFERENT sentences instead.
- NO list of features whose sole purpose is repeating keywords. Press releases prefer prose paragraphs over bullet lists anyway.

After writing, output a KEYWORD VERIFICATION table at the end of the appendix (after \`###\`) with the ACTUAL final counts. If your declared count differs from the real count by ≥1, the output is rejected.`)
  }

  // ── BLOCK 3: Internal links — softer than pages (wires strip them)
  const links = input.internalLinks ?? []
  if (links.length > 0) {
    const must = links.filter((l) => l.priority === 'must')
    const nice = links.filter((l) => l.priority !== 'must')

    lines.push(`# INTERNAL LINKS — anchor text VERBATIM, no URL invention

Paid newswires close every hyperlink from indexing — they apply \`rel="nofollow"\` attributes or rewrite the URL through a redirect domain before publishing. Build the release so the prose still works when the link is stripped or rewritten — the anchor phrase must read naturally as ordinary prose, and the surrounding sentence must hold together if the entire \`[anchor](url)\` is replaced by plain text \`anchor\`.

Total internal links: EXACTLY ${REQUIRED_INTERNAL_LINK_COUNT}. Not 1. Not 3. EXACTLY ${REQUIRED_INTERNAL_LINK_COUNT}. The paid publisher allows 2 outbound links per release; fewer wastes the slot, more is REJECTED at distribution. If the brief lists more than ${REQUIRED_INTERNAL_LINK_COUNT} candidates, pick the ${REQUIRED_INTERNAL_LINK_COUNT} highest-priority entries. If the brief lists fewer, do NOT invent extra links — use what's provided.

## MUST INSERT (each appears EXACTLY once, anchor verbatim)`)
    if (must.length === 0) {
      lines.push(`(no MUST links specified)`)
    } else {
      for (const l of must) {
        const alts = l.anchorAlts && l.anchorAlts.length > 0 ? ` (alternative anchors allowed: ${l.anchorAlts.map((a) => `"${a}"`).join(', ')})` : ''
        lines.push(`- [${l.anchor}](${l.url})${alts}${l.context ? ` — context: ${l.context}` : ''}`)
      }
    }
    if (nice.length > 0) {
      const needFromNice = Math.max(0, REQUIRED_INTERNAL_LINK_COUNT - must.length)
      lines.push(`\n## FILL-IN POOL (use ${needFromNice} of these to reach exactly ${REQUIRED_INTERNAL_LINK_COUNT} total links)`)
      for (const l of nice) {
        const alts = l.anchorAlts && l.anchorAlts.length > 0 ? ` (alternative anchors allowed: ${l.anchorAlts.map((a) => `"${a}"`).join(', ')})` : ''
        lines.push(`- [${l.anchor}](${l.url})${alts}${l.context ? ` — context: ${l.context}` : ''}`)
      }
    }
    lines.push(`\nRULES:
- Use the exact URL provided. Never invent a URL or path.
- Use the exact anchor text (or one of the listed alternatives). Do NOT paraphrase the anchor.
- Place links in BODY paragraphs only — never in the headline, subhead, dateline, quotes, boilerplate, media-contact block, or ad-label line.
- After insertion, the anchor phrase must read naturally with the surrounding sentence — not as a forced reference. If you cannot make it natural, choose a different fill-in candidate from the pool and try again.
- Total link count is enforced after generation. If your output has anything other than ${REQUIRED_INTERNAL_LINK_COUNT} brief-allowed markdown links, the postprocessor will flag it as a paid-distribution violation.`)
  }

  // ── BLOCK 4: Story beats (structure[] repurposed as paragraph map)
  const structure = input.structure ?? []
  if (structure.length > 0) {
    lines.push(`# STORY BEATS — order of paragraphs in the body

Walk the body in this order. Each beat is one paragraph. If a beat has subtopics, you may roll them up into the same paragraph or split into a follow-on paragraph — never more than one paragraph per beat.`)
    structure.forEach((s, i) => {
      lines.push(`${i + 1}. **${s.heading || '(unnamed beat)'}**`)
      if (s.subtopics && s.subtopics.length > 0) {
        for (const sub of s.subtopics) lines.push(`   - ${sub}`)
      }
    })
  }

  // ── BLOCK 5: LSI / secondary keyword list
  const lsi = input.lsiKeywords ?? []
  if (lsi.length > 0) {
    lines.push(`# LSI / SEMANTIC TERMS — weave AT LEAST ONE each into the body

${lsi.map((t) => `- ${t}`).join('\n')}

Use in body paragraphs (not quotes, not boilerplate). One natural mention each; do not list them together.`)
  }

  // ── BLOCK 6: Red flag words (block / warn)
  const reds = input.redFlags ?? []
  if (reds.length > 0) {
    const blocks = reds.filter((r) => r.severity === 'block')
    const warns = reds.filter((r) => r.severity !== 'block')
    lines.push(`# RED FLAG WORDS — do NOT use any of these in the output

## BLOCK (refuse entirely)
${blocks.length ? blocks.map((r) => `- ${r.word}${r.reason ? ` — ${r.reason}` : ''}`).join('\n') : '(none)'}

## WARN (avoid; if unavoidable, paraphrase)
${warns.length ? warns.map((r) => `- ${r.word}${r.reason ? ` — ${r.reason}` : ''}`).join('\n') : '(none)'}`)
  }

  // ── BLOCK 7: Knowledge base context (boilerplate source)
  if (input.knowledgeBaseContext && input.knowledgeBaseContext.trim().length > 0) {
    lines.push(`# KNOWLEDGE BASE CONTEXT — facts to draw from, and the boilerplate source

Use only facts that appear in this context (or the brief). Do NOT invent dollar amounts, regulator names, partners, customers, jurisdictions, or product features not present here.

**BOILERPLATE EXTRACTION:** If this context contains a paragraph that looks like an "About [Company]" block (factual one-paragraph company description), COPY IT VERBATIM into the "## About [Company]" section of the release. Do not paraphrase, do not expand, do not shorten. If no such block exists, write one factual paragraph based only on the company facts present here — no marketing language.

\`\`\`
${input.knowledgeBaseContext.trim()}
\`\`\``)
  }

  // ── BLOCK 8: Optional document / ICP context
  if (input.documentContext && input.documentContext.trim().length > 0) {
    lines.push(`# REFERENCE DOCUMENT

\`\`\`
${input.documentContext.trim()}
\`\`\``)
  }
  if (input.icpContext && input.icpContext.trim().length > 0) {
    lines.push(`# TARGET ICP CONTEXT

${input.icpContext.trim()}`)
  }

  // ── BLOCK 9: Brief
  lines.push(`# BRIEF

- Topic: ${input.topic}
- Target audience: ${input.targetAudience}
- Key messages: ${input.keyMessages?.trim() || '(none provided — infer from topic + KB context)'}
- Output language: ${language === 'en' ? 'English (AP Style)' : language === 'uk' ? 'Ukrainian' : 'Russian'}
- Word count target: ${wcMin}–${wcMax} words${input.notes ? `\n- Notes: ${input.notes}` : ''}`)

  // ── BLOCK 10: Revise-mode handoff (only when re-running on existing content)
  if (isRevise) {
    lines.push(`# CURRENT DRAFT — for ${input.revisionMode === 'edit' ? 'targeted edit' : 'full regeneration'}

The current saved draft is below. ${
      input.revisionMode === 'edit'
        ? `Apply the instructions in "REVISION INSTRUCTIONS" but preserve the SAME structure, the SAME quotes (unless instructed otherwise), the SAME internal links, and the SAME boilerplate verbatim. Output the full revised press release — not a diff.`
        : `Rewrite the press release end-to-end with the SAME topic and brief constraints but vary the headline, subhead, lead phrasing, body paragraphs, and quote attribution names. Keep every internal link URL identical and every anchor text identical to the brief. The boilerplate stays verbatim.`
    }

\`\`\`
${input.currentContent}
\`\`\`

# REVISION INSTRUCTIONS

${input.revisionInstructions || '(no specific instructions — apply the mode above)'}`)
  }

  // ── BLOCK 11: Hard-gates checklist (last thing model sees)
  lines.push(`# PRE-OUTPUT HARD GATES — verify all before emitting a single character

[ ] First line is \`**Word Count:** N words\` — N matches the actual body word count
[ ] Ad label line \`**${label}**\` is present BEFORE the headline (paid-distribution requirement, language-localised)
[ ] Headline: count characters INCLUDING SPACES — must be ≤ ${TITLE_MAX_CHARS}. Sentence-case, no period at end, contains the primary keyword.
[ ] Italic subhead present, ≤ 25 words
[ ] Bold dateline: \`**CITY, COUNTRY — Month D, YYYY**\` — real city the company would issue from, today's date
[ ] Lead paragraph (first paragraph after the dateline): primary keyword + company name in sentence 1, answers 5W in 2–3 sentences
[ ] At least one quote present, attributed in the form: "...quote...," said FirstName LastName, Title at Company.
[ ] No exclamation marks, no emoji, no buzzwords ("best", "leading", "world-class", "revolutionary", "unique") unless directly supported by the brief
[ ] "## About [Company]" boilerplate is either the verbatim KB block OR a one-paragraph factual description with no marketing language
[ ] "## Media Contact" block has Name, Title, Company, Email, Phone (use TBD placeholders if the brief is missing them, never invent contact details)
[ ] Release ends with the literal three characters \`###\` on their own line
[ ] Body word count from the ad label through \`###\` is between ${wcMin} and ${wcMax} (HARD CEILING ${BODY_MAX_WORDS})
[ ] Keyword counts within MIN–MAX for every keyword
[ ] EXACTLY ${REQUIRED_INTERNAL_LINK_COUNT} brief-allowed internal links present (no more, no fewer). Every MUST link appears once with the verbatim anchor. Anchor phrases read naturally as prose even if the link is stripped or replaced with a redirect URL.
[ ] KEYWORD VERIFICATION table emitted at the very end (after \`###\`) with the actual counts

If ANY gate fails, fix it BEFORE emitting output. Do not emit a release that fails any gate.`)

  return lines.join('\n\n')
}
