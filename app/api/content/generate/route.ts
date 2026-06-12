import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getOrCreateCurrentProject } from '@/lib/project'
import { buildBriefPrompt, type BriefData, type BriefInternalLink, type BriefRedFlag, type ContentType } from '@/lib/content-brief'
import { PAGE_SYSTEM_PROMPT_V3, buildPageUserPrompt } from '@/lib/prompts/page-system-v3'
import { postProcessPage, analyzeKeywordCoverage, buildKeywordTopUpPrompt } from '@/lib/prompts/page-postprocess'
import { findSimilarGeneratedContent } from '@/lib/rag'
import { embeddingsAvailable } from '@/lib/embeddings'
import { loadVectorStoreForScopes } from '@/lib/embedding-store'
import { obsidianScope } from '@/lib/obsidian-sync'

const VAULT_RAG_TOP_K = 6
const VAULT_RAG_MIN_SCORE = 0.55
const VAULT_RAG_MAX_CHARS = 4500 // soft cap to keep prompt budget bounded

async function buildKnowledgeBaseContext(
  projectId: string,
  query: string,
): Promise<{ context: string; sources: string[]; chars: number }> {
  if (!query.trim()) return { context: '', sources: [], chars: 0 }
  const store = await loadVectorStoreForScopes([obsidianScope(projectId)])
  const hits = await store.similaritySearchWithScore(query, VAULT_RAG_TOP_K)
  const parts: string[] = []
  const seenSources = new Set<string>()
  let totalChars = 0
  for (const [doc, score] of hits) {
    if (score < VAULT_RAG_MIN_SCORE) continue
    const source = (doc.metadata?.key as string) ?? 'unknown'
    const block = `### From: ${source}\n${doc.pageContent.trim()}`
    if (totalChars + block.length > VAULT_RAG_MAX_CHARS) break
    parts.push(block)
    seenSources.add(source)
    totalChars += block.length + 6 // +6 for "\n---\n\n" separator
  }
  return {
    context: parts.join('\n\n---\n\n'),
    sources: Array.from(seenSources),
    chars: totalChars,
  }
}

function makeBriefDigest(input: {
  contentType: ContentType
  topic: string
  targetAudience: string
  keyMessages: string
  brief: BriefData
}): string {
  const { contentType, topic, targetAudience, keyMessages, brief } = input
  const headings = brief.structure.map((b) => b.heading).filter(Boolean).join(' / ')
  const mainKw = brief.mainKeywords.map((k) => k.term).join(', ')
  return [
    `Content: ${topic}`,
    `Type: ${contentType}`,
    `Audience: ${targetAudience}`,
    `Tone: ${brief.tone}`,
    keyMessages ? `Key messages: ${keyMessages}` : '',
    brief.goal ? `Goal: ${brief.goal}` : '',
    headings ? `Structure: ${headings}` : '',
    mainKw ? `Main keywords: ${mainKw}` : '',
  ]
    .filter(Boolean)
    .join('. ')
}

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
// 300s is Vercel Pro's hard ceiling. We need ≥ first-LLM-call (≤90s) +
// post-process + optional keyword top-up second LLM call (≤90s) +
// re-postprocess + buffer. The previous 60s ceiling was tripping the
// function whenever the top-up pass fired, killing the `completed` SSE
// event and leaving the UI stuck on the streamed-only text.
export const maxDuration = 300

const CONTENT_TYPES: ContentType[] = ['article', 'catalog', 'linkedin', 'telegram']

function coerceBrief(raw: any): BriefData {
  // Fill missing fields with safe defaults
  return {
    pageUrl: typeof raw?.pageUrl === 'string' ? raw.pageUrl.trim() : '',
    icpId: raw?.icpId ?? null,
    icpIds: Array.isArray(raw?.icpIds)
      ? Array.from(new Set(raw.icpIds.map((x: any) => String(x ?? '').trim()).filter(Boolean)))
      : (raw?.icpId ? [String(raw.icpId)] : []),
    language: ['uk', 'en', 'ru'].includes(raw?.language) ? raw.language : 'uk',
    tone: String(raw?.tone ?? ''),
    format: String(raw?.format ?? ''),
    goal: String(raw?.goal ?? ''),
    placement: String(raw?.placement ?? ''),
    wordCountMin: Number.isFinite(raw?.wordCountMin) ? Number(raw.wordCountMin) : undefined,
    wordCountMax: Number.isFinite(raw?.wordCountMax) ? Number(raw.wordCountMax) : undefined,
    uniqueness: Number.isFinite(raw?.uniqueness) ? Number(raw.uniqueness) : 90,
    useH2: Boolean(raw?.useH2),
    useH3: Boolean(raw?.useH3),
    useLists: Boolean(raw?.useLists),
    allowHeadingReorder: Boolean(raw?.allowHeadingReorder),
    notes: String(raw?.notes ?? ''),
    structure: Array.isArray(raw?.structure)
      ? raw.structure
          .map((b: any) => ({
            heading: String(b?.heading ?? '').trim(),
            subtopics: Array.isArray(b?.subtopics) ? b.subtopics.map((s: any) => String(s ?? '').trim()).filter(Boolean) : [],
            allowSubdivision: Boolean(b?.allowSubdivision),
          }))
          .filter((b: any) => b.heading || b.subtopics.length > 0)
      : [],
    mainKeywords: Array.isArray(raw?.mainKeywords)
      ? raw.mainKeywords
          .map((k: any) => ({
            term: String(k?.term ?? '').trim(),
            minCount: Number.isFinite(Number(k?.minCount)) && Number(k.minCount) > 0 ? Number(k.minCount) : 1,
          }))
          .filter((k: any) => k.term)
      : [],
    lsiKeywords: Array.isArray(raw?.lsiKeywords)
      ? raw.lsiKeywords.map((k: any) => String(k ?? '').trim()).filter(Boolean)
      : [],
    redFlags: Array.isArray(raw?.redFlags)
      ? raw.redFlags
          .map((r: any) => ({
            word: String(r?.word ?? '').trim(),
            severity: r?.severity === 'block' ? 'block' : 'warn',
            reason: r?.reason ? String(r.reason).trim() : undefined,
          }))
          .filter((r: any) => r.word)
      : [],
    internalLinks: Array.isArray(raw?.internalLinks)
      ? raw.internalLinks
          .map((l: any) => ({
            url: String(l?.url ?? '').trim(),
            anchor: String(l?.anchor ?? '').trim(),
            anchorAlts: Array.isArray(l?.anchorAlts)
              ? l.anchorAlts.map((a: any) => String(a ?? '').trim()).filter(Boolean)
              : [],
            context: l?.context ? String(l.context).trim() : undefined,
            priority: l?.priority === 'must' ? 'must' : 'nice',
          }))
          .filter((l: any) => l.url && l.anchor)
      : [],
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id as string | undefined
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!process.env.ABACUSAI_API_KEY) {
    return NextResponse.json({ error: 'AI API key is not configured on the server' }, { status: 500 })
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const contentType = (CONTENT_TYPES.includes(body?.contentType) ? body.contentType : 'article') as ContentType
  const topic = String(body?.topic ?? '').trim()
  const targetAudience = String(body?.targetAudience ?? '').trim()
  const keyMessages = String(body?.keyMessages ?? '').trim()
  // Accept either icpIds[] (preferred) or single icpId (legacy). Dedupe + drop blanks.
  const rawIcpIds: string[] = Array.isArray(body?.icpIds)
    ? body.icpIds.map((x: any) => String(x ?? '').trim()).filter(Boolean)
    : (body?.icpId ? [String(body.icpId).trim()].filter(Boolean) : [])
  const icpIds: string[] = Array.from(new Set(rawIcpIds))
  const primaryIcpId = icpIds[0] ?? null
  const documentText = typeof body?.documentText === 'string' ? String(body.documentText).trim() : ''
  const documentName = typeof body?.documentName === 'string' ? String(body.documentName).trim() : ''

  if (!topic || !targetAudience) {
    return NextResponse.json({ error: 'Topic and target audience are required' }, { status: 400 })
  }

  const brief = coerceBrief({ ...(body?.brief ?? {}), icpId: primaryIcpId, icpIds })

  const project = await getOrCreateCurrentProject(userId)

  // ICP context — supports multiple personas. We fetch all selected ICPs in
  // one query, filter to those in this project, and render each as a numbered
  // block. The model is told upfront when content targets >1 persona so it
  // looks for shared pain points instead of writing for one and ignoring the
  // rest.
  let icpContext = ''
  if (icpIds.length > 0) {
    const icps = await prisma.iCP.findMany({
      where: { id: { in: icpIds }, projectId: project.id },
    })
    // Preserve user-selected order
    const ordered = icpIds
      .map((id) => icps.find((i) => i.id === id))
      .filter((i): i is NonNullable<typeof i> => Boolean(i))

    if (ordered.length === 1) {
      const icp = ordered[0]
      icpContext = `\n- Persona: ${icp.name}\n- Industry: ${icp.industry}\n- Company size: ${icp.companySize}\n- Pain points: ${(icp.painPoints ?? []).join('; ') || 'n/a'}\n- Goals: ${(icp.goals ?? []).join('; ') || 'n/a'}\n- Budget: ${icp.budgetRange || 'n/a'}\n- Demographics: ${icp.demographics || 'n/a'}\n- Decision process: ${icp.decisionProcess || 'n/a'}`
    } else if (ordered.length > 1) {
      const blocks = ordered.map((icp, idx) => {
        return `### Persona ${idx + 1}: ${icp.name}\n- Industry: ${icp.industry}\n- Company size: ${icp.companySize}\n- Pain points: ${(icp.painPoints ?? []).join('; ') || 'n/a'}\n- Goals: ${(icp.goals ?? []).join('; ') || 'n/a'}\n- Budget: ${icp.budgetRange || 'n/a'}\n- Demographics: ${icp.demographics || 'n/a'}\n- Decision process: ${icp.decisionProcess || 'n/a'}`
      })
      icpContext = `\n*This content targets ${ordered.length} personas — find shared pain points and goals; address all of them, not just one.*\n\n${blocks.join('\n\n')}`
    }
  }

  // Merge project-level red flags with per-brief overrides (brief takes precedence on dedupe)
  const projectRedFlags = await prisma.redFlagWord.findMany({
    where: {
      projectId: project.id,
      OR: [{ language: 'any' }, { language: brief.language }],
    },
  })
  const mergedRedFlagsMap = new Map<string, BriefRedFlag>()
  for (const r of projectRedFlags) {
    mergedRedFlagsMap.set(r.word.toLowerCase(), {
      word: r.word,
      severity: (r.severity as 'warn' | 'block') ?? 'warn',
      reason: r.reason ?? undefined,
    })
  }
  for (const r of brief.redFlags) {
    mergedRedFlagsMap.set(r.word.toLowerCase(), r)
  }
  const mergedRedFlags = Array.from(mergedRedFlagsMap.values())

  // Merge project-level internal links with per-brief overrides
  // Strategy: brief.internalLinks is the SELECTION — whatever the user picked for this brief
  // is what the AI will get (project library only serves as source). Deduplication by URL.
  const mergedLinksMap = new Map<string, BriefInternalLink>()
  for (const l of brief.internalLinks) {
    mergedLinksMap.set(l.url.toLowerCase(), { ...l, source: 'brief' })
  }
  const mergedInternalLinks = Array.from(mergedLinksMap.values())

  const documentContext = documentText
    ? `\n---\nReference document${documentName ? ` (${documentName})` : ''}:\n${documentText.slice(0, 9000)}${documentText.length > 9000 ? '\n\n[Document truncated]' : ''}`
    : ''

  // Pull relevant chunks from the project's Obsidian vault as factual ground
  // truth. Query combines topic, audience, key messages, and brief tags so the
  // retriever picks up on what the article is actually about. Falls back to no
  // context if embeddings are down — generation continues normally.
  let knowledgeBaseContext = ''
  let kbSources: string[] = []
  if (embeddingsAvailable()) {
    try {
      const kbQuery = [
        topic,
        targetAudience,
        keyMessages,
        ...(brief.mainKeywords ?? []).map((k) => k.term),
        ...(brief.lsiKeywords ?? []),
      ].filter(Boolean).join(' ')
      const kb = await buildKnowledgeBaseContext(project.id, kbQuery)
      knowledgeBaseContext = kb.context
      kbSources = kb.sources
      console.log(`KB context: ${kb.chars} chars from ${kb.sources.length} sources`)
    } catch (e) {
      console.warn('KB retrieval failed (continuing without):', e)
    }
  }

  // For page-style content (article / catalog) use the comprehensive PAGE
  // SYSTEM PROMPT V3 + structured user prompt with hard-gate tables.
  // Other content types (linkedin / telegram) keep the lightweight legacy
  // path since those formats have different requirements.
  const usePageSystem = contentType === 'article' || contentType === 'catalog'

  let systemPrompt: string
  let finalUserPrompt: string

  if (usePageSystem) {
    systemPrompt = PAGE_SYSTEM_PROMPT_V3
    finalUserPrompt = buildPageUserPrompt({
      topic,
      targetAudience,
      keyMessages,
      language: brief.language,
      wordCountMin: brief.wordCountMin,
      wordCountMax: brief.wordCountMax,
      mainKeywords: brief.mainKeywords,
      lsiKeywords: brief.lsiKeywords,
      internalLinks: mergedInternalLinks.map((l) => ({
        url: l.url,
        anchor: l.anchor,
        anchorAlts: l.anchorAlts,
        priority: l.priority,
        context: l.context,
      })),
      structure: brief.structure?.map((b) => ({ heading: b.heading, subtopics: b.subtopics })),
      knowledgeBaseContext,
      documentContext,
      icpContext,
      redFlags: mergedRedFlags,
      notes: brief.notes,
    })
  } else {
    const { system: legacySystem, user: legacyUser } = buildBriefPrompt({
      contentType,
      topic,
      targetAudience,
      keyMessages,
      brief,
      icpContext,
      mergedRedFlags,
      mergedInternalLinks,
      documentContext,
      knowledgeBaseContext,
    })
    systemPrompt = legacySystem
    finalUserPrompt = legacyUser
  }

  console.log('Generated prompts:')
  console.log('System prompt length:', systemPrompt.length)
  console.log('User prompt length:', finalUserPrompt.length)
  console.log('KB sources used:', kbSources.length ? kbSources.join(', ') : '(none)')
  console.log('Topic:', topic)
  console.log('Target audience:', targetAudience)
  console.log('Content type:', contentType)

  // Semantic dedupe: if a near-identical brief was generated before, return
  // the cached result and skip the upstream LLM call entirely. Requires
  // embeddings; on failure we silently fall through to a fresh generation.
  const dedupeAllowed = body?.skipDedupe !== true && embeddingsAvailable()
  let cachedHit: Awaited<ReturnType<typeof findSimilarGeneratedContent>> = null
  if (dedupeAllowed) {
    try {
      const digest = makeBriefDigest({ contentType, topic, targetAudience, keyMessages, brief })
      cachedHit = await findSimilarGeneratedContent(project.id, digest, { contentType })
    } catch (e) {
      console.warn('dedupe lookup failed (continuing to LLM):', e)
    }
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: any) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`))
      }

      let heartbeat: any = null

      // Cache hit: stream the cached brief back without calling Abacus.
      if (cachedHit) {
        try {
          send({
            status: 'cached',
            similarity: cachedHit.similarity,
            sourceContentId: cachedHit.contentId,
            sourceTopic: cachedHit.topic,
          })
          send({ status: 'processing', delta: cachedHit.generatedBrief })
          send({ status: 'completed', result: cachedHit.generatedBrief, cached: true })
          controller.enqueue(encoder.encode(`data: [DONE]\n\n`))
        } finally {
          try { controller.close() } catch {}
        }
        return
      }

      try {
        console.log('Starting Abacus API request...')
        const upstream = await fetch('https://apps.abacus.ai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.ABACUSAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: 'gpt-5.4-mini',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: finalUserPrompt },
            ],
            stream: true,
            max_tokens: usePageSystem ? 6000 : 3500,
          }),
        })

        console.log('Abacus response status:', upstream.status)
        if (!upstream.ok || !upstream.body) {
          const text = await upstream.text().catch(() => '')
          console.error('Abacus API error:', upstream.status, text)
          send({ status: 'error', message: `LLM upstream error: ${upstream.status} ${text.slice(0, 200)}` })
          controller.close()
          return
        }

        heartbeat = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(`: ping\n\n`))
          } catch {}
        }, 10000)

        const reader = upstream.body.getReader()
        const decoder = new TextDecoder()
        let partialRead = ''
        let fullText = ''
        let chunkCount = 0

        while (true) {
          const { done, value } = await reader.read()
          if (done) {
            console.log('Stream complete. Total chunks:', chunkCount, 'text length:', fullText.length)
            break
          }
          chunkCount++
          partialRead += decoder.decode(value, { stream: true })
          const lines = partialRead.split('\n')
          partialRead = lines.pop() ?? ''
          for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed) continue
            if (!trimmed.startsWith('data:')) {
              console.debug('Non-data line:', trimmed.slice(0, 50))
              continue
            }
            const data = trimmed.slice(5).trim()
            if (data === '[DONE]') {
              console.log('LLM stream done')
              continue
            }
            try {
              const parsed = JSON.parse(data)
              const delta: string = parsed?.choices?.[0]?.delta?.content ?? ''
              if (delta) {
                fullText += delta
                send({ status: 'processing', delta })
              }
            } catch (e) {
              console.debug('Parse error on line:', data.slice(0, 100), 'error:', e)
            }
          }
        }

        // Deterministic post-processing for page-style content. Each step
        // is wrapped in its own try/catch so a single failure (regex
        // throw, top-up timeout, etc.) can't silently kill the
        // `completed` SSE event downstream. Whatever text we have at any
        // point is what gets sent — never an empty completion.
        let finalText = fullText
        let postFixes: string[] = []

        if (usePageSystem) {
          const primary = (brief.mainKeywords ?? [])[0]
          const briefForPost = {
            primaryKeyword: primary ? { term: primary.term, minCount: primary.minCount } : undefined,
            secondaryKeywords: (brief.mainKeywords ?? []).slice(1),
            lsiKeywords: brief.lsiKeywords ?? [],
            internalLinks: mergedInternalLinks.map((l) => ({
              url: l.url,
              anchor: l.anchor,
              anchorAlts: (l as { anchorAlts?: string[] }).anchorAlts ?? [],
              priority: l.priority,
            })),
            topic,
          }

          // Helper: count how many brief-link INSTANCES are present in
          // `text` as full `[anchor](url)` markdown tokens. Used as a
          // "did the rewrite drop my links?" tripwire on the top-up
          // pass — see the guard below.
          //
          // Cardinality matters: brief can list multiple entries that
          // share the same URL (e.g. three different anchors all
          // pointing to "/"). For each URL we expect AS MANY markdown
          // occurrences as brief entries pointing there, capped at the
          // brief's count. A url-keyed presence test would falsely
          // claim "3/3 present" when only one markdown link exists, so
          // we count actual matches per URL.
          const countLinks = (text: string): number => {
            const urlCounts = new Map<string, number>()
            for (const l of briefForPost.internalLinks ?? []) {
              const u = l.url.trim()
              urlCounts.set(u, (urlCounts.get(u) ?? 0) + 1)
            }
            let total = 0
            for (const [url, briefCount] of urlCounts) {
              const escaped = url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
              const matches = text.match(new RegExp(`\\]\\(${escaped}\\)`, 'g')) ?? []
              total += Math.min(matches.length, briefCount)
            }
            return total
          }

          // ── Pass 1: deterministic postprocess (links + caps + metadata)
          try {
            const post = postProcessPage(fullText, briefForPost)
            if (post.fixes.length) console.log('[generate] postprocess fixes:', post.fixes)
            finalText = post.text
            postFixes = post.fixes
          } catch (e) {
            console.error('[generate] postprocess threw', e)
            postFixes.push(`postprocess errored (${(e as Error)?.message ?? 'unknown'}); using raw LLM output`)
            finalText = fullText
          }
          postFixes.push(`[audit] brief links present after pass 1: ${countLinks(finalText)}/${briefForPost.internalLinks?.length ?? 0}`)

          // ── Pass 2: keyword coverage rescue (optional second LLM call)
          // Skipped silently if everything is already covered — cheapest
          // path stays cheap. Fires a SECOND LLM call (non-streaming,
          // single shot) to weave gaps in naturally when needed. The
          // rewrite prompt forbids stuffing and requires preserving
          // links + structure, so the second pass is safe to
          // re-postprocess and keep.
          try {
            const coverage = analyzeKeywordCoverage(finalText, briefForPost)
            if (!coverage.allCovered) {
              postFixes.push(
                ...coverage.underMain.map((u) => `keyword under-count "${u.term}": ${u.have}/${u.want}`),
                ...coverage.missingLsi.map((t) => `LSI missing: "${t}"`),
              )

              // 90s ceiling on the top-up call so it can't hang the whole
              // function. If the LLM upstream takes longer than that we
              // abandon the top-up and keep the original draft —
              // postFixes records the timeout so the operator sees why.
              const topUpController = new AbortController()
              const topUpTimer = setTimeout(() => topUpController.abort(), 90_000)

              let topUpRes: Response | null = null
              try {
                topUpRes = await fetch('https://apps.abacus.ai/v1/chat/completions', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${process.env.ABACUSAI_API_KEY}`,
                  },
                  body: JSON.stringify({
                    model: 'gpt-5.4-mini',
                    messages: [
                      { role: 'system', content: systemPrompt },
                      { role: 'user', content: buildKeywordTopUpPrompt(finalText, coverage) },
                    ],
                    stream: false,
                    max_tokens: 6000,
                  }),
                  signal: topUpController.signal,
                })
              } finally {
                clearTimeout(topUpTimer)
              }

              if (topUpRes && topUpRes.ok) {
                const data = await topUpRes.json()
                const rewritten: string = data?.choices?.[0]?.message?.content ?? ''
                if (rewritten.trim().length > 200) {
                  // ── Critical guard: rollback if top-up dropped links ──
                  // The keyword-coverage rewrite is meant to weave terms
                  // into existing sentences, but LLMs routinely strip
                  // formatting they don't understand. If the rewrite has
                  // fewer brief-URL markdown tokens than the original,
                  // it has demonstrably lost links the operator put
                  // there on purpose — accepting it would trade keyword
                  // wins for link losses, which is a worse outcome than
                  // keeping the draft as-is. Postprocess re-injection
                  // helps but it can't re-add a link whose anchor text
                  // the rewrite also rephrased. Safer to reject.
                  const beforeLinks = countLinks(finalText)
                  const linksInRewrite = countLinks(rewritten)
                  if (linksInRewrite < beforeLinks) {
                    postFixes.push(
                      `top-up REJECTED: rewrite kept only ${linksInRewrite}/${beforeLinks} brief links — original draft preserved instead`,
                    )
                  } else {
                    // Re-run postprocess on the rewrite to keep links + caps clean.
                    try {
                      const secondPost = postProcessPage(rewritten, briefForPost)
                      // Belt-and-braces: re-check link count AFTER pass-2
                      // postprocess too. If the See-also fallback was
                      // the only thing keeping a link present we still
                      // detect that and roll back to the cleaner draft.
                      const finalLinks = countLinks(secondPost.text)
                      if (finalLinks < beforeLinks) {
                        postFixes.push(
                          `top-up ROLLED BACK after re-postprocess: ${finalLinks}/${beforeLinks} brief links survived (was ${beforeLinks}/${beforeLinks}) — original draft kept`,
                        )
                      } else {
                        finalText = secondPost.text
                        postFixes.push(`keyword top-up applied (${coverage.underMain.length + coverage.missingLsi.length} gap${coverage.underMain.length + coverage.missingLsi.length === 1 ? '' : 's'})`)
                        postFixes.push(`[audit] brief links present after top-up: ${finalLinks}/${briefForPost.internalLinks?.length ?? 0}`)
                        postFixes.push(...secondPost.fixes.map((f) => `[top-up] ${f}`))
                        const finalCov = analyzeKeywordCoverage(finalText, briefForPost)
                        if (!finalCov.allCovered) {
                          postFixes.push(
                            ...finalCov.underMain.map((u) => `WARNING: still under-count after top-up: "${u.term}" ${u.have}/${u.want}`),
                            ...finalCov.missingLsi.map((t) => `WARNING: LSI still missing after top-up: "${t}"`),
                          )
                        }
                      }
                    } catch (e) {
                      console.error('[generate] post-top-up postprocess threw', e)
                      postFixes.push(`top-up rewrite arrived but re-postprocess errored; original draft kept`)
                    }
                  }
                } else {
                  postFixes.push('keyword top-up returned too-short result; original draft kept')
                }
              } else if (topUpRes) {
                postFixes.push(`keyword top-up upstream error ${topUpRes.status}; original draft kept`)
              }
            }
          } catch (e) {
            const msg = (e as Error)?.message ?? 'unknown'
            console.error('[generate] keyword top-up failed', e)
            postFixes.push(
              msg.toLowerCase().includes('abort')
                ? 'keyword top-up timed out after 90s; original draft kept'
                : `keyword top-up errored (${msg}); original draft kept`,
            )
          }
        }

        // Defensive: if some legacy / aborted run left the in-progress
        // marker in the body, strip it before sending. New runs never
        // emit it; this is belt-and-braces for output that may have
        // accumulated it during the buggy window.
        finalText = finalText.replace(/\n*\[keyword top-up in progress…\]\n*/g, '\n\n')

        // Surface the postprocess fixes alongside the final text so the UI can
        // show the operator "AI missed link X, we injected it as See-also" or
        // "link Y is still missing — please add it manually". The studio form
        // already renders postFixes as a collapsible warnings panel.
        send({ status: 'completed', result: finalText, postFixes })
        controller.enqueue(encoder.encode(`data: [DONE]\n\n`))
      } catch (err: any) {
        console.error('generation stream error', err)
        try {
          send({ status: 'error', message: err?.message ?? 'Generation failed' })
        } catch {}
      } finally {
        if (heartbeat) clearInterval(heartbeat)
        try {
          controller.close()
        } catch {}
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
