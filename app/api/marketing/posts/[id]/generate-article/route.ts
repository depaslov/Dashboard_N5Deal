import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { assertProjectAccess } from '@/lib/project'
import { callLLM, MissingLLMKey } from '@/lib/marketing/llm'
import { SITE_ARTICLE_SYSTEM_PROMPT, buildSiteArticleUserPrompt } from '@/lib/prompts/site-article'
import { lintArticle, summariseViolations, type Violation } from '@/lib/prompts/site-article-lint'

// Build the refinement prompt: send the article back to the model with the
// exact violations the linter caught + explicit instructions to fix ONLY
// those issues. Keeps structure / keywords / anchors / SEO block intact.
function buildRefinementPrompt(article: string, violations: Violation[]): string {
  const grouped = violations.reduce((acc, v) => {
    if (!acc[v.category]) acc[v.category] = []
    acc[v.category].push(v)
    return acc
  }, {} as Record<string, Violation[]>)

  const sections: string[] = []
  if (grouped.banned_word?.length) {
    sections.push(`BANNED WORDS DETECTED — rewrite the sentences they appear in. Replace with neutral, specific alternatives:\n${grouped.banned_word.map((v) => `  - "${v.term}" (×${v.count}) — excerpt: ${v.excerpt}`).join('\n')}`)
  }
  if (grouped.banned_phrase?.length) {
    sections.push(`BANNED PHRASES — rewrite or delete:\n${grouped.banned_phrase.map((v) => `  - "${v.term}" (×${v.count}) — excerpt: ${v.excerpt}`).join('\n')}`)
  }
  if (grouped.generic_opener?.length) {
    sections.push(`GENERIC OPENER in the first paragraph — rewrite the opening sentence so the first 50 words are SPECIFIC to this topic, not interchangeable with any other article:\n${grouped.generic_opener.map((v) => `  - "${v.term}" — opening: ${v.excerpt}`).join('\n')}`)
  }
  if (grouped.advisory_framing?.length) {
    sections.push(`ADVISORY FRAMING — N5Deal INFORMS, never CONSULTS. Rewrite these so N5Deal is positioned as a marketplace/informational platform, not an advisor:\n${grouped.advisory_framing.map((v) => `  - "${v.term}" (×${v.count}) — excerpt: ${v.excerpt}`).join('\n')}`)
  }
  if (grouped.forbidden_term?.length) {
    sections.push(`FORBIDDEN COMPLIANCE TERMS — these are hard "never use regardless of context" per Part 9 of the spec. Rewrite the sentences using compliant alternatives:\n${grouped.forbidden_term.map((v) => `  - "${v.term}" (×${v.count}) — excerpt: ${v.excerpt}`).join('\n')}`)
  }
  if (grouped.banking_reference?.length) {
    sections.push(`"BANK / BANKING" REFERENCES outside regulator proper nouns — substitute with "licensed financial institution", "regulated entity", "EMI", "PSP", or the specific licence type:\n${grouped.banking_reference.map((v) => `  - "${v.term}" (×${v.count}) — excerpt: ${v.excerpt}`).join('\n')}`)
  }

  return `The article below failed the post-output checklist. Fix ONLY the issues listed below. Preserve:
- Word count target (600–750 words body)
- Article structure (Word Count header, BRIEF DERIVED block if present, H1, Key Takeaways, all H2 sections, FAQ, Bottom Line, Disclaimer, SEO METADATA block)
- Every keyword and its bold formatting
- The N5Deal anchor links (1–2 max)
- The Disclaimer wording (verbatim — do not touch)

Output ONLY the full corrected article in markdown, starting with **Word Count:** as in the original.

────── VIOLATIONS TO FIX ──────

${sections.join('\n\n')}

────── ORIGINAL ARTICLE ──────

${article}`
}

async function refineOnce(article: string, violations: Violation[]): Promise<string> {
  const refined = await callLLM(
    [
      { role: 'system', content: SITE_ARTICLE_SYSTEM_PROMPT },
      { role: 'user', content: buildRefinementPrompt(article, violations) },
    ],
    { maxTokens: 4096 },
  )
  return refined.trim()
}

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
// 600–750 word body + structure + SEO block can sit in the 3–4K token range
// and the LLM can be slow when the post-output checklist forces self-review.
export const maxDuration = 300

const BodySchema = z.object({
  topic: z.string().min(3).max(500),
  primaryKeyword: z.string().max(120).optional(),
  secondaryKeywords: z.array(z.string().max(120)).max(6).optional(),
})

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id as string | undefined
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Confirm the post exists and the caller has access to its project.
  const post = await prisma.socialPost.findUnique({ where: { id: params.id } })
  if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const ok = await assertProjectAccess(userId, post.projectId)
  if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Site article generation only makes sense for Article-type posts. Block
  // other types so operators don't accidentally rewrite a reel caption with
  // a 750-word essay.
  if (post.type !== 'Article') {
    return NextResponse.json(
      { error: 'Site article generation only applies to Article-type posts.' },
      { status: 400 },
    )
  }

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid fields' },
      { status: 400 },
    )
  }

  const userPrompt = buildSiteArticleUserPrompt({
    topic: parsed.data.topic,
    primaryKeyword: parsed.data.primaryKeyword,
    secondaryKeywords: parsed.data.secondaryKeywords,
  })

  let raw: string
  try {
    raw = await callLLM(
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

  let article = raw.trim()
  if (!article) {
    return NextResponse.json({ error: 'Model returned empty article.' }, { status: 502 })
  }

  // Deterministic post-output check. The model often glides past parts of
  // the spec it agreed to follow (banned vocab, generic openers, advisory
  // framing, "bank/banking" outside regulator names…). If we find any, do
  // ONE refinement pass with the exact violations attached so the model
  // can target the fix instead of regenerating from scratch.
  let violations = lintArticle(article)
  let refineUsed = false
  if (violations.length > 0) {
    try {
      const refined = await refineOnce(article, violations)
      if (refined && refined.length > 200) {
        article = refined
        refineUsed = true
        violations = lintArticle(article)
      }
    } catch {
      // Refinement is best-effort. If it fails the original article still
      // gets saved; remaining violations are surfaced to the operator.
    }
  }

  // Save the article body to the post's content field. Title stays as-is —
  // the operator can either keep the placeholder "Site article — 01.06" or
  // rename it to the H1 the model produced.
  const updated = await prisma.socialPost.update({
    where: { id: params.id },
    data: { content: article },
  })

  return NextResponse.json({
    post: updated,
    article,
    refineUsed,
    violations: summariseViolations(violations),
  })
}
