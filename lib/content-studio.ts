// Foundation of Content Studio's prompt-assembly step (TT §4.2 step 4):
// given a content type, optional platform, topic, ICPs and other dynamic
// inputs, find the most-specific PromptTemplate and render it against a rich
// context object. Returns the assembled system + user prompts ready for
// review or LLM submission.

import { prisma } from './db'
import { renderTemplate } from './prompt-template'
import { obsidianScope } from './obsidian-sync'
import { loadVectorStoreForScopes } from './embedding-store'
import { embeddingsAvailable } from './embeddings'
import { PAGE_SYSTEM_PROMPT_V3, buildPageUserPrompt } from './prompts/page-system-v3'

const KB_TOP_K = 6
const KB_MIN_SCORE = 0.55
const KB_MAX_CHARS = 4500

export interface AssembleInput {
  projectId: string
  contentType: string
  topic: string
  targetAudience?: string
  keyMessages?: string
  language?: 'en' | 'uk' | 'ru'
  icpIds?: string[]
  platformId?: string | null
  promptTemplateId?: string | null  // override template selection
  documentText?: string
  sourceUrl?: string                 // for Market News
  mainKeywords?: { term: string; minCount: number }[]
  lsiKeywords?: string[]
  wordCountMin?: number
  wordCountMax?: number
  secondaryAudience?: string
  sectionOutline?: string[]
  // Per-brief internal links. When provided AND non-empty, these OVERRIDE
  // the project library entirely — only these URLs+anchors are sent to
  // the LLM and only these are accepted by the post-processor. Lets the
  // operator hard-pin the anchors from the technical brief (TZ) instead
  // of leaking the project library's default anchors into the page.
  internalLinks?: {
    url: string
    anchor: string
    anchorAlts?: string[]
    context?: string | null
    priority?: 'must' | 'nice'
  }[]
  // New SEO-aware fields used by the v2 Pages/Articles templates
  primaryGoal?: string
  externalSources?: string
}

export interface AssembleResult {
  systemPrompt: string
  userPrompt: string
  meta: {
    templateId: string | null
    templateName: string | null
    icpNames: string[]
    platform: { id: string; name: string; slug: string } | null
    kbSources: string[]
    kbChars: number
    icpTags: string[]
    internalLinkCount: number
  }
  // Snapshot of the brief data needed for server-side post-processing of the
  // LLM output (keyword cap, link whitelist, metadata header injection).
  // Forwarded by the client to /api/content/generate-from-prompt so the
  // generator can enforce the brief's hard limits on the final document.
  brief: {
    topic: string
    primaryKeyword: { term: string; minCount: number } | null
    secondaryKeywords: { term: string; minCount: number }[]
    lsiKeywords: string[]
    internalLinks: { url: string; anchor: string; priority: 'must' | 'nice' }[]
  }
}

async function pickTemplate(projectId: string, contentType: string, platformId: string | null, explicitId: string | null) {
  if (explicitId) {
    const t = await prisma.promptTemplate.findUnique({ where: { id: explicitId } })
    if (t && t.projectId === projectId && t.isActive) return t
  }
  // Most specific: contentType + platform
  if (platformId) {
    const t = await prisma.promptTemplate.findFirst({
      where: { projectId, contentType, platformId, isActive: true },
      orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
    })
    if (t) return t
  }
  // Fallback: contentType only (no platform binding)
  return prisma.promptTemplate.findFirst({
    where: { projectId, contentType, platformId: null, isActive: true },
    orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
  })
}

function renderIcpBlock(icps: any[]): string {
  if (icps.length === 0) return ''
  if (icps.length === 1) {
    const i = icps[0]
    return `- Persona: ${i.name}\n- Industry: ${i.industry}\n- Company size: ${i.companySize}\n- Pain points: ${(i.painPoints ?? []).join('; ') || 'n/a'}\n- Goals: ${(i.goals ?? []).join('; ') || 'n/a'}\n- Budget: ${i.budgetRange || 'n/a'}\n- Demographics: ${i.demographics || 'n/a'}\n- Decision process: ${i.decisionProcess || 'n/a'}`
  }
  const blocks = icps.map((i, idx) =>
    `### Persona ${idx + 1}: ${i.name}\n- Industry: ${i.industry}\n- Pain points: ${(i.painPoints ?? []).join('; ') || 'n/a'}\n- Goals: ${(i.goals ?? []).join('; ') || 'n/a'}`,
  )
  return `*This content targets ${icps.length} personas — find shared pain points; address all of them.*\n\n${blocks.join('\n\n')}`
}

function renderMainKeywordsBlock(kws: { term: string; minCount: number }[]): string {
  if (kws.length === 0) return ''
  return kws.map((k) => `- "${k.term}" — bold at first use, target min ${k.minCount}× in body`).join('\n')
}

function renderInternalLinksBlock(links: { url: string; anchor: string; anchorAlts: string[]; context: string | null; priority: string }[]): string {
  if (links.length === 0) return ''
  return links.map((l) => {
    const alts = (l.anchorAlts ?? []).filter(Boolean).join(', ')
    return `- ${l.priority === 'must' ? '[MUST] ' : ''}[${l.anchor}](${l.url})${alts ? ` (alt anchors: ${alts})` : ''}${l.context ? ` — context: ${l.context}` : ''}`
  }).join('\n')
}

function renderRedFlagsBlock(flags: { word: string; severity: string; reason?: string | null }[]): string {
  if (flags.length === 0) return ''
  const blocks = flags
    .filter((f) => f.severity === 'block')
    .map((f) => `- "${f.word}" — ${f.reason ?? 'avoid'}`)
  const warns = flags
    .filter((f) => f.severity === 'warn')
    .map((f) => `- "${f.word}"`)
  const parts: string[] = []
  if (blocks.length) parts.push(`### NEVER use (block):\n${blocks.join('\n')}`)
  if (warns.length) parts.push(`### Use with care (warn):\n${warns.join('\n')}`)
  return parts.join('\n\n')
}

async function buildKbContext(projectId: string, query: string): Promise<{ context: string; sources: string[]; chars: number }> {
  if (!query.trim() || !embeddingsAvailable()) return { context: '', sources: [], chars: 0 }
  try {
    const store = await loadVectorStoreForScopes([obsidianScope(projectId)])
    const hits = await store.similaritySearchWithScore(query, KB_TOP_K)
    const parts: string[] = []
    const seen = new Set<string>()
    let total = 0
    for (const [doc, score] of hits) {
      if (score < KB_MIN_SCORE) continue
      const src = String(doc.metadata?.key ?? 'unknown')
      const block = `### From: ${src}\n${doc.pageContent.trim()}`
      if (total + block.length > KB_MAX_CHARS) break
      parts.push(block)
      seen.add(src)
      total += block.length + 6
    }
    return { context: parts.join('\n\n---\n\n'), sources: Array.from(seen), chars: total }
  } catch {
    return { context: '', sources: [], chars: 0 }
  }
}

export async function assembleStudioPrompt(input: AssembleInput): Promise<AssembleResult> {
  const language = input.language ?? 'en'

  // If the brief specifies its own internal links, those are the source of
  // truth — we skip the project-library fetch entirely. The operator's
  // brief anchors then go to the LLM verbatim (no merging, no DB defaults).
  const briefLinks = Array.isArray(input.internalLinks) && input.internalLinks.length > 0
    ? input.internalLinks
    : null

  // Load template, ICPs, platform, red flags, ICP tags, internal links in parallel.
  const [template, icps, platform, redFlags, icpTagLinks, dbInternalLinks] = await Promise.all([
    pickTemplate(input.projectId, input.contentType, input.platformId ?? null, input.promptTemplateId ?? null),
    (input.icpIds && input.icpIds.length > 0)
      ? prisma.iCP.findMany({ where: { id: { in: input.icpIds }, projectId: input.projectId } })
      : Promise.resolve([]),
    input.platformId
      ? prisma.platform.findUnique({ where: { id: input.platformId } })
      : Promise.resolve(null),
    prisma.redFlagWord.findMany({
      where: { projectId: input.projectId, OR: [{ language: 'any' }, { language }] },
      select: { word: true, severity: true, reason: true },
    }),
    (input.icpIds && input.icpIds.length > 0)
      ? prisma.iCPTag.findMany({
          where: { icpId: { in: input.icpIds } },
          include: { tag: { select: { name: true } } },
        })
      : Promise.resolve([]),
    // Skip the project-library fetch entirely when the brief specifies its
    // own links — saves a DB roundtrip + guarantees no leakage.
    briefLinks
      ? Promise.resolve([] as { url: string; anchor: string; anchorAlts: string[]; context: string | null; priority: string }[])
      : prisma.internalLink.findMany({
          where: { projectId: input.projectId, isActive: true },
          orderBy: [{ priority: 'asc' }, { anchor: 'asc' }],
          select: { url: true, anchor: true, anchorAlts: true, context: true, priority: true },
        }),
  ])

  // Final list of links the LLM (and the post-processor whitelist) will see.
  const internalLinks = briefLinks
    ? briefLinks.map((l) => ({
        url: l.url,
        anchor: l.anchor,
        anchorAlts: l.anchorAlts ?? [],
        context: l.context ?? null,
        priority: l.priority ?? 'nice',
      }))
    : dbInternalLinks

  // Reorder ICPs to match input order
  const orderedIcps = (input.icpIds ?? [])
    .map((id) => icps.find((i) => i.id === id))
    .filter((i): i is NonNullable<typeof i> => Boolean(i))

  const icpTagNames = Array.from(new Set(icpTagLinks.map((l) => l.tag.name))).sort()

  // KB context — query combines topic + audience + tags
  const kbQuery = [input.topic, input.targetAudience, input.keyMessages, ...icpTagNames].filter(Boolean).join(' ')
  const kb = await buildKbContext(input.projectId, kbQuery)

  // Validate platform belongs to project
  const safePlatform = platform && platform.projectId === input.projectId ? platform : null

  const ctx = {
    topic: input.topic,
    audience: input.targetAudience ?? '',
    keyMessages: input.keyMessages ?? '',
    language,
    sourceUrl: input.sourceUrl ?? '',
    document: input.documentText ?? '',
    icpNames: orderedIcps.map((i) => i.name),
    icps: renderIcpBlock(orderedIcps),
    icpTags: icpTagNames,
    platform: safePlatform
      ? {
          name: safePlatform.name,
          slug: safePlatform.slug,
          formatType: safePlatform.formatType,
          tone: safePlatform.tone ?? '',
          hashtagRules: safePlatform.hashtagRules ?? '',
          disclaimers: safePlatform.disclaimers ?? '',
          promptFragment: safePlatform.promptFragment ?? '',
          minLength: safePlatform.minLength ?? '',
          maxLength: safePlatform.maxLength ?? '',
          lengthUnit: safePlatform.lengthUnit,
        }
      : null,
    redFlags: renderRedFlagsBlock(redFlags),
    kbContext: kb.context,
    mainKeywords: renderMainKeywordsBlock(input.mainKeywords ?? []),
    primaryKeyword: (() => {
      const k = (input.mainKeywords ?? [])[0]
      return k ? `"${k.term}" — bold every natural appearance, target min ${k.minCount}× across the body` : ''
    })(),
    // Raw primary keyword + count for templates that compose their own copy
    // around the term (new SEO-aware Pages/Articles prompts use these).
    primaryKeywordRaw: (input.mainKeywords ?? [])[0]?.term ?? '',
    primaryKeywordMinCount: (input.mainKeywords ?? [])[0]?.minCount ?? '',
    primaryKeywordMin: (input.mainKeywords ?? [])[0]?.minCount ?? '',
    primaryKeywordMax: (() => {
      const k = (input.mainKeywords ?? [])[0]
      return k ? Math.max(k.minCount * 2, k.minCount + 3) : ''
    })(),
    secondaryKeywords: renderMainKeywordsBlock((input.mainKeywords ?? []).slice(1)),
    lsiKeywords: input.lsiKeywords ?? [],
    primaryGoal: input.primaryGoal ?? input.keyMessages ?? '',
    externalSources: input.externalSources ?? '',
    internalLinks: renderInternalLinksBlock(internalLinks),
    internalLinkCount: internalLinks.length,
    wordCountMin: input.wordCountMin ?? '',
    wordCountMax: input.wordCountMax ?? '',
    audiencePrimary: input.targetAudience ?? '',
    audienceSecondary: input.secondaryAudience ?? '',
    sectionOutline: (input.sectionOutline ?? [])
      .map((h) => h.trim()).filter(Boolean)
      .map((h, i) => `${i + 1}. ${h}`).join('\n'),
  }

  // Hard fallback if no template was found — keep the API usable while
  // marketers seed their own templates. This is intentionally bare so it
  // signals "no template configured".
  const fallbackSystem = `You are an assistant helping the marketing team write content of type "${input.contentType}". Follow user instructions precisely.`
  const fallbackUser = [
    `# Topic\n${input.topic}`,
    input.targetAudience ? `# Audience\n${input.targetAudience}` : '',
    ctx.icps ? `# ICPs\n${ctx.icps}` : '',
    ctx.platform ? `# Platform\n${ctx.platform.name} (${ctx.platform.formatType})\nTone: ${ctx.platform.tone}\nLength: ${ctx.platform.minLength}-${ctx.platform.maxLength} ${ctx.platform.lengthUnit}\n${ctx.platform.promptFragment}` : '',
    ctx.kbContext ? `# Knowledge Base\n${ctx.kbContext}` : '',
    ctx.redFlags ? `# Red flags\n${ctx.redFlags}` : '',
  ].filter(Boolean).join('\n\n')

  // For page-style content (pages / articles) override the DB template with the
  // strict PAGE_SYSTEM_PROMPT_V3 + buildPageUserPrompt. The DB template is too
  // soft — after 6 review rounds at 6-7.5/10 the same issues kept appearing
  // (keyword overuse, missing metadata header, missing MUST links, invented
  // URLs). The strict pair has HARD GATES and is paired with a deterministic
  // server-side post-processor that enforces the brief's MAX limits.
  const isPageStyle = input.contentType === 'pages' || input.contentType === 'articles'

  let systemPrompt: string
  let userPrompt: string
  if (isPageStyle) {
    systemPrompt = PAGE_SYSTEM_PROMPT_V3
    userPrompt = buildPageUserPrompt({
      topic: input.topic,
      targetAudience: input.targetAudience ?? '',
      keyMessages: input.keyMessages ?? '',
      language,
      wordCountMin: input.wordCountMin,
      wordCountMax: input.wordCountMax,
      mainKeywords: input.mainKeywords ?? [],
      lsiKeywords: input.lsiKeywords ?? [],
      internalLinks: internalLinks.map((l) => ({
        url: l.url,
        anchor: l.anchor,
        anchorAlts: l.anchorAlts ?? [],
        priority: (l.priority === 'must' ? 'must' : 'nice') as 'must' | 'nice',
        context: l.context ?? undefined,
      })),
      structure: (input.sectionOutline ?? []).map((h) => ({ heading: h, subtopics: [] })),
      knowledgeBaseContext: kb.context,
      documentContext: input.documentText,
      icpContext: ctx.icps,
      redFlags: redFlags.map((r) => ({
        word: r.word,
        severity: (r.severity === 'block' ? 'block' : 'warn') as 'block' | 'warn',
        reason: r.reason ?? undefined,
      })),
    })
  } else {
    systemPrompt = template ? renderTemplate(template.systemTemplate, ctx) : fallbackSystem
    userPrompt = template ? renderTemplate(template.userTemplate, ctx) : fallbackUser
  }

  return {
    systemPrompt,
    userPrompt,
    meta: {
      templateId: template?.id ?? null,
      templateName: isPageStyle ? `${template?.name ?? '(no DB template)'} → overridden by PAGE_SYSTEM_PROMPT_V3` : (template?.name ?? null),
      icpNames: orderedIcps.map((i) => i.name),
      platform: safePlatform ? { id: safePlatform.id, name: safePlatform.name, slug: safePlatform.slug } : null,
      kbSources: kb.sources,
      kbChars: kb.chars,
      icpTags: icpTagNames,
      internalLinkCount: internalLinks.length,
    },
    brief: {
      topic: input.topic,
      primaryKeyword: (input.mainKeywords ?? [])[0]
        ? { term: input.mainKeywords![0].term, minCount: input.mainKeywords![0].minCount }
        : null,
      secondaryKeywords: (input.mainKeywords ?? []).slice(1).map((k) => ({ term: k.term, minCount: k.minCount })),
      lsiKeywords: input.lsiKeywords ?? [],
      internalLinks: internalLinks.map((l) => ({
        url: l.url,
        anchor: l.anchor,
        priority: (l.priority === 'must' ? 'must' : 'nice') as 'must' | 'nice',
      })),
    },
  }
}
