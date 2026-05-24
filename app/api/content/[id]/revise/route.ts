import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { assertProjectAccess } from '@/lib/project'
import { PAGE_SYSTEM_PROMPT_V3 } from '@/lib/prompts/page-system-v3'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

const ABACUSAI_URL = 'https://apps.abacus.ai/v1/chat/completions'
const MODEL = process.env.ABACUSAI_MODEL ?? 'gpt-5.4-mini'

const BodySchema = z.object({
  mode: z.enum(['regenerate', 'edit']),
  instructions: z.string().max(5_000).optional(),
})

const REGENERATE_INSTRUCTION = `Rewrite this page end-to-end from scratch. Keep the SAME topic, primary keyword, target audience, and overall purpose. Vary the opening, structure, examples, transitions, and wording so it reads as a fundamentally different draft. Preserve every internal link, named source, factual claim, and the disclaimer verbatim. The new draft must score AT LEAST as well as the current draft against every rule in the system prompt — anti-degradation rules apply.`

// Pull the original brief (keywords, internal links, jurisdiction signals, etc.)
// so the LLM has the same constraints during revision as it did at generation time.
// Without this the model loses keyword counts, link URLs, and section structure —
// which is exactly why iterated revisions drift toward lower quality.
function buildBriefContext(briefData: any, contentType: string, topic: string, targetAudience: string, keyMessages: string): string {
  const lines: string[] = []
  lines.push(`# Original brief context (must be respected on every revision)`)
  lines.push(`- Topic: ${topic}`)
  lines.push(`- Content type: ${contentType}`)
  lines.push(`- Target audience: ${targetAudience}`)
  if (keyMessages) lines.push(`- Key messages: ${keyMessages}`)

  if (briefData && typeof briefData === 'object') {
    if (briefData.language) lines.push(`- Output language: ${briefData.language}`)
    if (briefData.wordCountMin || briefData.wordCountMax) {
      lines.push(`- Target word count: ${briefData.wordCountMin ?? '—'}–${briefData.wordCountMax ?? '—'}`)
    }
    if (briefData.pageUrl) lines.push(`- Page URL: ${briefData.pageUrl}`)

    if (Array.isArray(briefData.mainKeywords) && briefData.mainKeywords.length > 0) {
      lines.push(`\n## Primary + secondary keywords (MIN/MAX both enforced)`)
      for (const k of briefData.mainKeywords) {
        const min = Number(k?.minCount ?? 1)
        const max = Math.max(min * 2, min + 3)
        lines.push(`- "${k?.term ?? ''}" — min ${min}, max ${max}, bold every natural occurrence`)
      }
    }

    if (Array.isArray(briefData.lsiKeywords) && briefData.lsiKeywords.length > 0) {
      lines.push(`\n## LSI keywords (≥60% must appear naturally across the page)`)
      lines.push(briefData.lsiKeywords.map((k: any) => `- "${String(k)}"`).join('\n'))
    }

    if (Array.isArray(briefData.internalLinks) && briefData.internalLinks.length > 0) {
      lines.push(`\n## Internal links — STRICT: exactly 2–3 total, no duplicates, exact URLs only`)
      for (const l of briefData.internalLinks) {
        const prio = l?.priority === 'must' ? '[MUST]' : '[OPTIONAL]'
        const alts = Array.isArray(l?.anchorAlts) && l.anchorAlts.length ? ` (alt: ${l.anchorAlts.join(', ')})` : ''
        lines.push(`- ${prio} [${l?.anchor ?? ''}](${l?.url ?? ''})${alts}`)
      }
    }

    if (Array.isArray(briefData.structure) && briefData.structure.length > 0) {
      lines.push(`\n## Required H2 outline (use these exact headings, in this order)`)
      briefData.structure.forEach((b: any, i: number) => {
        lines.push(`${i + 1}. ${b?.heading ?? '(TBD)'}`)
      })
    }
  }

  return lines.join('\n')
}

function buildUserPrompt(args: {
  currentContent: string
  instructions: string
  mode: 'regenerate' | 'edit'
  briefContext: string
}): string {
  const { currentContent, instructions, mode, briefContext } = args
  const intent =
    mode === 'regenerate'
      ? 'REGENERATION REQUEST'
      : 'TARGETED EDIT REQUEST'

  return `${briefContext}

---

# ${intent}
${instructions}

---

# Current content (this is what to revise)
${currentContent}

---

# Output rules (read carefully)
- Apply EVERY rule in the system prompt. The HARD GATES (A–G) are non-negotiable on every revision — quality must NOT decline relative to the current content.
- Preserve every internal link, every named external source, every concrete number/jurisdiction/date already present — unless the user request explicitly says otherwise.
- Preserve the final disclaimer verbatim.
- Honour the keyword MIN/MAX limits from the brief context above.
- Output ONLY the revised page (Markdown). No preamble like "Here is the revised version". No commentary.
- End with the SEO METADATA + KEYWORD VERIFICATION + INTERNAL LINKS PLACED + PRE-OUTPUT CHECKLIST blocks defined in PART 13 of the system prompt.

# CRITICAL — FINAL REMINDER (re-read before writing)
Your output MUST literally begin with these three lines, exactly:
\`\`\`
**Word Count:** N words
*Reading Time: X minutes*
*Tags: tag1, tag2, tag3, tag4, tag5*
\`\`\`
Then a blank line, then the H1. Skipping the Tags or Reading Time lines = output rejected (GATE A).

Primary keyword in headings: H1 + AT MOST 1 other H2/H3. All remaining H2/H3 must use "the license" or rephrase. Putting the primary keyword in every H2 = output rejected (GATE C.1).

First sentence after H1: must follow "A/The [primary keyword] is..." or "[primary keyword] grants...". Starting with "In [year]", "Founders comparing...", "Most...", "Under [framework]..." = output rejected (GATE D).

The page MUST contain an H3 "What [License] doesn't cover" with a concrete excluded-activity example (GATE E) AND a global-analogue paragraph naming another country + regulator (GATE F). Both missing in current content reviews — do not skip them.`
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id as string | undefined
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const content = await prisma.generatedContent.findUnique({ where: { id: params.id } })
  if (!content) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const ok = await assertProjectAccess(userId, content.projectId)
  if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid fields' }, { status: 400 })
  }

  if (parsed.data.mode === 'edit' && !parsed.data.instructions?.trim()) {
    return NextResponse.json({ error: 'Instructions are required for edit mode' }, { status: 400 })
  }

  const instructions =
    parsed.data.mode === 'regenerate' ? REGENERATE_INSTRUCTION : parsed.data.instructions!.trim()

  if (!process.env.ABACUSAI_API_KEY) {
    return NextResponse.json({ error: 'AI is not configured on the server' }, { status: 503 })
  }

  const briefContext = buildBriefContext(
    content.briefData,
    content.contentType,
    content.topic,
    content.targetAudience,
    content.keyMessages,
  )

  try {
    const upstream = await fetch(ABACUSAI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.ABACUSAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: PAGE_SYSTEM_PROMPT_V3 },
          {
            role: 'user',
            content: buildUserPrompt({
              currentContent: content.generatedBrief ?? '',
              instructions,
              mode: parsed.data.mode,
              briefContext,
            }),
          },
        ],
        max_tokens: 6000,
        stream: false,
      }),
    })

    if (!upstream.ok) {
      const text = await upstream.text().catch(() => '')
      return NextResponse.json(
        { error: `LLM upstream error ${upstream.status}: ${text.slice(0, 200)}` },
        { status: 502 },
      )
    }
    const data = await upstream.json()
    const newText: string = data?.choices?.[0]?.message?.content ?? ''
    if (!newText.trim()) {
      return NextResponse.json({ error: 'LLM returned empty content' }, { status: 502 })
    }

    const updated = await prisma.generatedContent.update({
      where: { id: params.id },
      data: { generatedBrief: newText },
    })
    return NextResponse.json({
      content: { id: updated.id, generatedBrief: updated.generatedBrief },
      mode: parsed.data.mode,
    })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message ?? 'Revision failed' }, { status: 502 })
  }
}
