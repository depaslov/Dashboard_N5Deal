import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getOrCreateCurrentProject } from '@/lib/project'
import { assembleStudioPrompt } from '@/lib/content-studio'

export const dynamic = 'force-dynamic'

// TT §4.2 step 4: returns the assembled prompt for the marketer to review.
// No LLM call here. The reviewed prompt is then submitted to /api/content/generate
// for actual generation.
export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id as string | undefined
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: any
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const topic = String(body?.topic ?? '').trim()
  if (!topic) return NextResponse.json({ error: 'Topic is required' }, { status: 400 })
  const contentType = String(body?.contentType ?? '').trim()
  if (!contentType) return NextResponse.json({ error: 'contentType is required' }, { status: 400 })

  const project = await getOrCreateCurrentProject(userId)

  const result = await assembleStudioPrompt({
    projectId: project.id,
    contentType,
    topic,
    targetAudience: typeof body?.targetAudience === 'string' ? body.targetAudience.trim() : '',
    keyMessages: typeof body?.keyMessages === 'string' ? body.keyMessages.trim() : '',
    language: ['uk', 'en', 'ru'].includes(body?.language) ? body.language : 'en',
    icpIds: Array.isArray(body?.icpIds) ? body.icpIds.map((x: any) => String(x ?? '').trim()).filter(Boolean) : [],
    platformId: body?.platformId ? String(body.platformId) : null,
    promptTemplateId: body?.promptTemplateId ? String(body.promptTemplateId) : null,
    documentText: typeof body?.documentText === 'string' ? body.documentText : '',
    sourceUrl: typeof body?.sourceUrl === 'string' ? body.sourceUrl.trim() : '',
    mainKeywords: Array.isArray(body?.mainKeywords)
      ? body.mainKeywords
          .map((k: any) => {
            const min = Number.isFinite(Number(k?.minCount)) && Number(k.minCount) > 0 ? Math.floor(Number(k.minCount)) : 1
            const maxRaw = Number(k?.maxCount)
            const max = Number.isFinite(maxRaw) && maxRaw >= min ? Math.floor(maxRaw) : undefined
            return { term: String(k?.term ?? '').trim(), minCount: min, maxCount: max }
          })
          .filter((k: any) => k.term)
      : [],
    lsiKeywords: Array.isArray(body?.lsiKeywords)
      ? body.lsiKeywords.map((k: any) => String(k ?? '').trim()).filter(Boolean)
      : [],
    wordCountMin: Number.isFinite(Number(body?.wordCountMin)) && Number(body.wordCountMin) > 0 ? Math.floor(Number(body.wordCountMin)) : undefined,
    wordCountMax: Number.isFinite(Number(body?.wordCountMax)) && Number(body.wordCountMax) > 0 ? Math.floor(Number(body.wordCountMax)) : undefined,
    secondaryAudience: typeof body?.secondaryAudience === 'string' ? body.secondaryAudience.trim() : '',
    sectionOutline: Array.isArray(body?.sectionOutline)
      ? body.sectionOutline.map((s: any) => String(s ?? '').trim()).filter(Boolean)
      : [],
    sectionStructure: Array.isArray(body?.sectionStructure)
      ? body.sectionStructure
          .map((b: any) => ({
            heading: String(b?.heading ?? '').trim(),
            subtopics: Array.isArray(b?.subtopics) ? b.subtopics.map((s: any) => String(s ?? '').trim()).filter(Boolean) : [],
          }))
          .filter((b: any) => b.heading)
      : [],
    // Per-brief internal links — when provided, override the project library.
    // The operator's anchors are used verbatim; the post-processor whitelist
    // also flips to this set.
    internalLinks: Array.isArray(body?.internalLinks)
      ? body.internalLinks
          .map((l: any) => ({
            url: String(l?.url ?? '').trim(),
            anchor: String(l?.anchor ?? '').trim(),
            anchorAlts: Array.isArray(l?.anchorAlts) ? l.anchorAlts.map((a: any) => String(a ?? '').trim()).filter(Boolean) : [],
            context: l?.context ? String(l.context).trim() : null,
            priority: l?.priority === 'must' ? 'must' as const : 'nice' as const,
          }))
          .filter((l: any) => l.url && l.anchor)
      : undefined,
  })

  return NextResponse.json(result)
}
