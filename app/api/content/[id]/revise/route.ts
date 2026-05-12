import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { assertProjectAccess } from '@/lib/project'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

const ABACUSAI_URL = 'https://apps.abacus.ai/v1/chat/completions'
const MODEL = process.env.ABACUSAI_MODEL ?? 'gpt-5.4-mini'

const BodySchema = z.object({
  mode: z.enum(['regenerate', 'edit']),
  instructions: z.string().max(5_000).optional(),
})

const REGENERATE_INSTRUCTION = `Regenerate this content end-to-end. Keep the same topic, target audience, and overall tone. Substantively vary the structure, opening, examples, and wording while preserving all factual claims, the primary keyword strategy, every internal link in the original, and the final disclaimer verbatim. Aim for a fundamentally different reading experience while delivering the same information. Do not repeat the opening sentence pattern of the original.`

const SYSTEM_PROMPT = `You revise marketing content for N5Deal based on user feedback or regeneration requests.

NON-NEGOTIABLE COMPLIANCE (override anything else):
- N5DEAL IS an informational platform / introducer / fintech builder. NEVER a bank / broker / advisor / fund / asset manager.
- We INFORM, not CONSULT. We EXPLAIN, not ADVISE. The user makes the decision.
- Subject + verb: "the platform connects / introduces / lists", "the marketplace shows". NEVER "n5deal advises / recommends / manages / guarantees".
- Preserve every internal link and every named external source from the original.
- Preserve the existing disclaimer paragraph at the end verbatim.

HUMANIZATION (mandatory):
- Banned words (replace every occurrence): leverage, unlock, seamlessly, robust, delve, embark, harness, pivotal, cultivate, transformative, ever-evolving, intricate, multifaceted, realm, landscape (figurative), arsenal, showcase (verb), bolster, empower, dynamic, holistic, comprehensive, myriad, plethora, tapestry, vibrant, foster.
- Banned phrases: "in conclusion", "in summary", "furthermore", "moreover", "it is important to note", "navigating the complexities", "this is where X comes in", "stay ahead of the curve", "a deep dive into", "in today's fast-paced world", "the digital age", "play a pivotal role".
- Em-dashes ≤ 2 in the body total — em-dash overuse is a strong AI fingerprint.
- ≥ 3 contractions in body prose ("it's", "don't", "won't", "they're"). Disclaimers stay un-contracted.
- Mix sentence lengths: at least one short sentence (<12 words) and one long (>22 words) per H2 section. Never 3 consecutive sentences of similar length.
- ≥ 2 short sentence fragments for emphasis across the body.
- Every paragraph needs a concrete anchor (named jurisdiction, date, number, framework, or company).

OUTPUT FORMAT:
- Apply user instructions exactly.
- Output ONLY the revised content — no preamble, no commentary, no "Here is the revised version".
- Preserve the markdown structure (H1, H2, H3, bullet lists, bold).`

function buildUserPrompt(currentContent: string, instructions: string): string {
  return `# Current content
${currentContent}

# Revision instructions
${instructions}

Output the FULL revised version below. Begin directly with the revised content — no preamble, no headings like "Revised version:". Just the content.`
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
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: buildUserPrompt(content.generatedBrief ?? '', instructions) },
        ],
        max_tokens: 4096,
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
