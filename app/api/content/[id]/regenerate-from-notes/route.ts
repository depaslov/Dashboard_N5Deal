import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { assertProjectAccess } from '@/lib/project'
import { callLLM, MissingLLMKey } from '@/lib/marketing/llm'
import { SITE_ARTICLE_SYSTEM_PROMPT } from '@/lib/prompts/site-article'
import { lintArticle, summariseViolations } from '@/lib/prompts/site-article-lint'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

// POST /api/content/[id]/regenerate-from-notes
//   1. Read the current generatedBrief + every annotation on the piece
//   2. Hand both to the LLM with explicit "rewrite the article applying every
//      correction" instructions
//   3. Run the same lint + auto-refine pass we run on fresh generations
//   4. Save the revised brief
//   5. Promote each annotation's note into project-level CorrectionMemo so
//      future generations on the same project don't repeat the same mistake.
//      De-dupe against existing active memos (case-insensitive note match).
//   6. Mark every promoted annotation as resolved so the orange dot is no
//      longer driven by them (operator can re-open if needed)
//
// Returns the new brief + counts so the UI can confirm what happened.
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id as string | undefined
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const content = await prisma.generatedContent.findUnique({
    where: { id: params.id },
    include: {
      annotations: { orderBy: { createdAt: 'asc' } },
    },
  })
  if (!content) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const ok = await assertProjectAccess(userId, content.projectId)
  if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Operator needs at least one note to drive the regeneration — otherwise
  // there's nothing to act on and we'd just be re-running the original
  // prompt. Surface this clearly instead of silently no-op'ing.
  const annotations = content.annotations
  if (annotations.length === 0) {
    return NextResponse.json(
      { error: 'No notes / corrections found on this article. Add at least one inline note before regenerating.' },
      { status: 400 },
    )
  }

  // Pull existing project-level memory so the model sees it on this run too —
  // not just on future ones. Older memos go in front; the model anchors on
  // the bulk of the rules near the top of the user prompt.
  const existingMemos = await prisma.correctionMemo.findMany({
    where: { projectId: content.projectId, active: true },
    select: { note: true },
    orderBy: { createdAt: 'asc' },
  })
  const memorySnippets = existingMemos.map((m) => m.note)

  const correctionBlock = annotations
    .map((a, i) => {
      const ctxBefore = a.contextBefore ? `   Surrounding text before: "${a.contextBefore.trim().slice(-80)}"\n` : ''
      const ctxAfter = a.contextAfter ? `   Surrounding text after: "${a.contextAfter.trim().slice(0, 80)}"\n` : ''
      return `${i + 1}. Selected text: "${a.selectedText.trim()}"
${ctxBefore}${ctxAfter}   Operator note / correction: ${a.note.trim() || '(empty note — text was flagged but reason left blank, infer the fix from the selection)'}`
    })
    .join('\n\n')

  const memoryBlock = memorySnippets.length > 0
    ? `## PROJECT-LEVEL CORRECTIONS — apply to EVERY sentence

The operator previously flagged these issues on earlier articles. Treat
each line as a hard rule on top of the system prompt — they take
precedence over inferred style and must be applied throughout:

${memorySnippets.map((m, i) => `${i + 1}. ${m}`).join('\n')}

`
    : ''

  const userPrompt = `${memoryBlock}# Regenerate this article — applying every operator correction

You generated the article below previously. The operator has reviewed it
and flagged ${annotations.length} specific issue${annotations.length === 1 ? '' : 's'}.
Your job is to rewrite the FULL article applying EVERY correction.

Preserve:
- Word count target (600–750 words body)
- The structure: **Word Count** header, BRIEF DERIVED block if present,
  H1, **Key Takeaways**, 4–5 H2 sections, FAQ, Bottom Line, Disclaimer,
  SEO METADATA block
- Every keyword and its bold formatting
- The N5Deal anchor links (1–2 max)
- The Disclaimer wording verbatim
- Compliance with the system prompt's banned vocab / forbidden terms

# Inline corrections to apply

${correctionBlock}

# Previous article (to be rewritten)

${content.generatedBrief}

# Output

Return ONLY the complete rewritten article in markdown, starting with
\`**Word Count:**\`. No preamble, no commentary, no "here is the revised
article" prefix.`

  let revised: string
  try {
    revised = await callLLM(
      [
        { role: 'system', content: SITE_ARTICLE_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      { maxTokens: 4096 },
    )
  } catch (err) {
    if (err instanceof MissingLLMKey) {
      return NextResponse.json(
        { error: 'AI generation is not configured. Add ABACUSAI_API_KEY to the server environment.' },
        { status: 503 },
      )
    }
    return NextResponse.json(
      { error: (err as Error).message ?? 'LLM call failed' },
      { status: 502 },
    )
  }

  revised = revised.trim()
  if (!revised || revised.length < 200) {
    return NextResponse.json({ error: 'Model returned an unusably short article.' }, { status: 502 })
  }

  // Same lint sweep we use on fresh generations. We don't auto-refine here
  // (the operator already triggered one explicit rewrite); we just surface
  // remaining violations so they can decide whether to run it again.
  const violations = lintArticle(revised)

  // Promote each annotation's note into project memory so the same mistake
  // doesn't repeat on the next article. De-dupe against memos that already
  // contain the same note (case-insensitive trim match) so the memory
  // doesn't bloat over weeks of iteration.
  const existingNotesLower = new Set(existingMemos.map((m) => m.note.trim().toLowerCase()))
  const newMemos = annotations
    .map((a) => ({ note: a.note.trim(), selectedText: a.selectedText.trim() }))
    .filter((m) => m.note.length > 0 && !existingNotesLower.has(m.note.toLowerCase()))

  await prisma.$transaction([
    prisma.generatedContent.update({
      where: { id: params.id },
      data: {
        generatedBrief: revised,
        // Stash the pre-regenerate version so the UI can render an
        // inline Google-Docs-style diff until the operator hits Accept
        // or Revert. We grab content.generatedBrief from the outer scope
        // — it's the text loaded BEFORE this transaction runs.
        previousBrief: content.generatedBrief,
      },
    }),
    // Add new memos
    ...newMemos.map((m) =>
      prisma.correctionMemo.create({
        data: {
          projectId: content.projectId,
          note: m.note,
          selectedText: m.selectedText || null,
          sourceContentId: params.id,
          active: true,
        },
      }),
    ),
    // Mark every annotation on this piece as resolved — the operator can
    // un-resolve any that weren't actually fixed when they re-read the
    // output. Keeping them around (rather than deleting) preserves the
    // history of why we regenerated.
    prisma.contentAnnotation.updateMany({
      where: { contentId: params.id, resolved: false },
      data: { resolved: true },
    }),
  ])

  return NextResponse.json({
    brief: revised,
    annotationsApplied: annotations.length,
    memosAdded: newMemos.length,
    totalMemoSize: existingMemos.length + newMemos.length,
    violations: summariseViolations(violations),
  })
}
