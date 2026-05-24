import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { assertProjectAccess } from '@/lib/project'
import { PAGE_SYSTEM_PROMPT_V3, buildPageUserPrompt } from '@/lib/prompts/page-system-v3'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

const ABACUSAI_URL = 'https://apps.abacus.ai/v1/chat/completions'
const MODEL = process.env.ABACUSAI_MODEL ?? 'gpt-5.4-mini'

const BodySchema = z.object({
  mode: z.enum(['regenerate', 'edit']),
  instructions: z.string().max(5_000).optional(),
})

const REGENERATE_INSTRUCTION = `Rewrite this page end-to-end from scratch. Keep the SAME topic, primary keyword, target audience, and overall purpose. Vary the opening, structure, examples, transitions, and wording so it reads as a fundamentally different draft. Preserve every internal link URL (and the exact anchor text), every named source, factual claim, and the disclaimer verbatim. The new draft must score AT LEAST as well as the current draft against every HARD GATE — quality must not decline.`

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

  // Re-use the original brief (keywords with MIN/MAX, internal-link URLs with
  // priorities + exact anchors, LSI list, structure) so the revise pass gets
  // EXACTLY the same constraints as the initial generation. Without this the
  // model drifts on each iteration — picks wrong anchors, invents URLs, etc.
  const brief = (content.briefData as any) ?? {}

  const finalUserPrompt = buildPageUserPrompt({
    topic: content.topic,
    targetAudience: content.targetAudience,
    keyMessages: content.keyMessages,
    language: brief.language,
    wordCountMin: brief.wordCountMin,
    wordCountMax: brief.wordCountMax,
    mainKeywords: Array.isArray(brief.mainKeywords) ? brief.mainKeywords : [],
    lsiKeywords: Array.isArray(brief.lsiKeywords) ? brief.lsiKeywords : [],
    internalLinks: Array.isArray(brief.internalLinks)
      ? brief.internalLinks.map((l: any) => ({
          url: String(l?.url ?? ''),
          anchor: String(l?.anchor ?? ''),
          anchorAlts: Array.isArray(l?.anchorAlts) ? l.anchorAlts.map((a: any) => String(a)) : [],
          priority: l?.priority === 'must' ? 'must' : 'nice',
          context: l?.context ? String(l.context) : undefined,
        }))
      : [],
    structure: Array.isArray(brief.structure)
      ? brief.structure.map((b: any) => ({
          heading: String(b?.heading ?? ''),
          subtopics: Array.isArray(b?.subtopics) ? b.subtopics.map((s: any) => String(s)) : [],
        }))
      : [],
    redFlags: Array.isArray(brief.redFlags) ? brief.redFlags : [],
    notes: brief.notes ? String(brief.notes) : undefined,
    // Revise-specific
    currentContent: content.generatedBrief ?? '',
    revisionInstructions: instructions,
    revisionMode: parsed.data.mode,
  })

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
          { role: 'user', content: finalUserPrompt },
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
