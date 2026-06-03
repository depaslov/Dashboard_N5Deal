import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { assertProjectAccess } from '@/lib/project'
import { callLLM, MissingLLMKey } from '@/lib/marketing/llm'
import { SITE_ARTICLE_SYSTEM_PROMPT, buildSiteArticleUserPrompt } from '@/lib/prompts/site-article'

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

  const article = raw.trim()
  if (!article) {
    return NextResponse.json({ error: 'Model returned empty article.' }, { status: 502 })
  }

  // Save the article body to the post's content field. Title stays as-is —
  // the operator can either keep the placeholder "Site article — 01.06" or
  // rename it to the H1 the model produced.
  const updated = await prisma.socialPost.update({
    where: { id: params.id },
    data: { content: article },
  })

  return NextResponse.json({ post: updated, article })
}
