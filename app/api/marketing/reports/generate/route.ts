import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getOrCreateCurrentProject } from '@/lib/project'
import { callAnthropic, MissingAnthropicKey, type MessageContent } from '@/lib/marketing/anthropic'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

const BodySchema = z.object({
  // Array of base64 data URLs ("data:image/png;base64,...") — max 9 screenshots.
  screenshots: z.array(z.string().regex(/^data:image\/(png|jpe?g|webp);base64,/)).min(1).max(9),
  // Optional title hint (e.g. "May 2026 report")
  title: z.string().max(200).optional(),
  periodLabel: z.string().max(100).optional(),
})

const SYSTEM_PROMPT = `You analyse marketing analytics screenshots from Instagram, YouTube, LinkedIn, and Google Analytics. You output structured marketing reports for a B2B fintech company called n5deal.`

const USER_INSTRUCTION = (today: string) => `Analyse these marketing analytics screenshots. Output exactly TWO sections separated by the literal marker line "---JSON---":

SECTION 1 — HTML REPORT (using these specific CSS classes that the dashboard renders):
- Wrap the whole body in <div class="rv">
- <h1> with the report title
- <div class="rp"> with the date / period
- <h2> for each platform (Instagram, YouTube, LinkedIn, Website)
- <h3> for sub-sections
- For metric blocks use this exact structure:
  <div class="mg"><div class="mc"><div class="mv">VALUE</div><div class="ml">LABEL</div><div class="md up">+X%</div></div></div>
  (use class "up" for positive deltas, "dn" for negative)
- <table> for data tables (top content, traffic sources, etc.)
- <div class="ins">...</div> for key insights (write at least 3-4 insights)
- For funnel-style step blocks use:
  <div class="fnr"><div class="fns"><div class="fnv">NUM</div><div class="fnl">LABEL</div><div class="fns2">sub</div></div></div>

SECTION 2 — JSON METRICS (after the ---JSON--- marker, valid JSON only):
{
  "instagram": { "followers": N|null, "reach": N|null, "impressions": N|null, "engagement": N|null, "adSpend": N|null, "ctr": N|null, "linkTaps": N|null, "profileVisits": N|null },
  "youtube":   { "subscribers": N|null, "views": N|null, "watchTime": N|null, "retention": N|null, "videoViews": N|null, "impressions": N|null, "ctr": N|null },
  "linkedin":  { "followers": N|null, "impressions": N|null, "uniqueReaders": N|null, "clicks": N|null, "reactions": N|null, "comments": N|null, "engRate": N|null, "leads": N|null, "spend": N|null, "organic": N|null, "sponsored": N|null },
  "website":   { "sessions": N|null, "engagedSessions": N|null, "engagementRate": N|null, "avgEngagementTime": N|null, "eventsPerSession": N|null, "eventCount": N|null }
}

Use null (not "null", not 0, not "—") for any metric you cannot extract from the screenshots. Output ONLY the HTML, then the literal line ---JSON---, then the JSON object. No prose before or after.

Report generated: ${today}`

function parseDataUrl(dataUrl: string): { mediaType: string; data: string } {
  const m = dataUrl.match(/^data:(image\/(?:png|jpe?g|webp));base64,(.+)$/)
  if (!m) throw new Error('Invalid data URL')
  return { mediaType: m[1], data: m[2] }
}

function splitResult(text: string): { html: string; metrics: Record<string, unknown> } {
  const idx = text.indexOf('---JSON---')
  if (idx < 0) return { html: text, metrics: {} }
  const html = text.slice(0, idx).trim()
  const jsonPart = text.slice(idx + '---JSON---'.length).trim()
  let metrics: Record<string, unknown> = {}
  try {
    // Strip code fences if Claude wrapped the JSON
    const cleaned = jsonPart.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim()
    metrics = JSON.parse(cleaned)
  } catch {
    // ignore — metrics stays empty; html is still useful
  }
  return { html, metrics }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id as string | undefined
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const project = await getOrCreateCurrentProject(userId)

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

  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  const periodLabel = parsed.data.periodLabel ?? today
  const title = parsed.data.title ?? `Marketing Report — ${today}`

  // Build content array: images first, then instruction text
  const content: MessageContent[] = parsed.data.screenshots.map((s) => {
    const { mediaType, data } = parseDataUrl(s)
    return { type: 'image' as const, source: { type: 'base64' as const, media_type: mediaType, data } }
  })
  content.push({ type: 'text' as const, text: USER_INSTRUCTION(today) })

  let raw: string
  try {
    raw = await callAnthropic([{ role: 'user', content }], { system: SYSTEM_PROMPT, maxTokens: 4096 })
  } catch (err) {
    if (err instanceof MissingAnthropicKey) {
      return NextResponse.json(
        { error: 'AI report generation is not configured. Add ANTHROPIC_API_KEY to the server environment.' },
        { status: 503 },
      )
    }
    return NextResponse.json(
      { error: (err as Error).message ?? 'LLM call failed' },
      { status: 502 },
    )
  }

  const { html, metrics } = splitResult(raw)
  if (!html.trim()) {
    return NextResponse.json({ error: 'LLM returned empty report' }, { status: 502 })
  }

  const report = await prisma.marketingReport.create({
    data: {
      projectId: project.id,
      title,
      periodLabel,
      html,
      metrics: metrics as object,
      imgCount: parsed.data.screenshots.length,
      notesByChannel: { instagram: '', youtube: '', linkedin: '', website: '' },
    },
  })

  return NextResponse.json({ report: { id: report.id, title: report.title, periodLabel: report.periodLabel } })
}
