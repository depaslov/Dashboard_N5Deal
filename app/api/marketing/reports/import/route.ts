import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { marked } from 'marked'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getOrCreateCurrentProject } from '@/lib/project'
import { callLLM, MissingLLMKey } from '@/lib/marketing/llm'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

// Hard cap on input size — protects against multi-MB pastes that blow the
// LLM token budget without giving anything useful in return.
const MAX_CHARS = 250_000

const TextBody = z.object({
  kind: z.enum(['html', 'markdown', 'text']),
  content: z.string().min(20).max(MAX_CHARS),
  title: z.string().max(200).optional(),
  periodLabel: z.string().max(100).optional(),
})

const PdfBody = z.object({
  kind: z.literal('pdf'),
  // base64 data URL: "data:application/pdf;base64,..."
  dataUrl: z.string().regex(/^data:application\/pdf;base64,/),
  title: z.string().max(200).optional(),
  periodLabel: z.string().max(100).optional(),
})

const BodySchema = z.union([TextBody, PdfBody])

const SYSTEM_PROMPT = `You ingest a pre-written marketing analytics report (HTML, Markdown, plain text, or PDF text) for a B2B fintech company called n5deal. Your job is to (1) re-render the same content in the dashboard's HTML template using the specific classes the dashboard styles, and (2) extract a structured JSON of the per-channel metric numbers so the dashboard's Compare tab can chart deltas across reports.`

const USER_INSTRUCTION = (today: string, sourceLabel: string, body: string) => `Below is a marketing report (${sourceLabel}). Re-render it in the dashboard's template AND extract per-channel metrics.

Output exactly TWO sections separated by the literal marker line "---JSON---":

SECTION 1 — HTML REPORT using these specific CSS classes that the dashboard renders:
- Wrap the whole body in <div class="rv">
- <h1> with the report title
- <div class="rp"> with the date / period
- <h2> for each platform (Instagram, YouTube, LinkedIn, Website) — also use <h2> for cross-channel summary / next-30-days style sections
- <h3> for sub-sections
- For metric blocks use this exact structure:
  <div class="mg"><div class="mc"><div class="mv">VALUE</div><div class="ml">LABEL</div><div class="md up">+X%</div></div></div>
  (use class "up" for positive deltas, "dn" for negative, "nu" for neutral)
- <table> for data tables (top content, traffic sources, etc.)
- <div class="ins">...</div> for key insights — preserve every insight in the source
- For funnel-style step blocks use:
  <div class="fnr"><div class="fns"><div class="fnv">NUM</div><div class="fnl">LABEL</div><div class="fns2">sub</div></div></div>

Do NOT include any <style>, <script>, <html>, <head>, or <body> tag — only the inner content starting with <div class="rv">. The dashboard supplies the stylesheet.

Preserve ALL information in the source: every metric, every insight paragraph, every table row, every "what worked / what didn't" block. Translation only — do not summarise.

SECTION 2 — JSON METRICS (after the ---JSON--- marker, valid JSON only):
{
  "instagram": { "followers": N|null, "reach": N|null, "impressions": N|null, "engagement": N|null, "adSpend": N|null, "ctr": N|null, "linkTaps": N|null, "profileVisits": N|null },
  "youtube":   { "subscribers": N|null, "views": N|null, "watchTime": N|null, "retention": N|null, "videoViews": N|null, "impressions": N|null, "ctr": N|null },
  "linkedin":  { "followers": N|null, "impressions": N|null, "uniqueReaders": N|null, "clicks": N|null, "reactions": N|null, "comments": N|null, "engRate": N|null, "leads": N|null, "spend": N|null, "organic": N|null, "sponsored": N|null },
  "website":   { "sessions": N|null, "engagedSessions": N|null, "engagementRate": N|null, "avgEngagementTime": N|null, "eventsPerSession": N|null, "eventCount": N|null }
}

Use null (not "null", not 0, not "—") for any metric you cannot find in the source. Numbers must be plain numbers (no commas, no "K"/"M" suffix — convert "25K" to 25000, "1.86K" to 1860). Output ONLY the HTML, then the literal line ---JSON---, then the JSON object. No prose before or after.

Report ingested: ${today}

────── SOURCE REPORT ──────

${body}`

function splitResult(text: string): { html: string; metrics: Record<string, unknown> } {
  const idx = text.indexOf('---JSON---')
  if (idx < 0) return { html: text, metrics: {} }
  const html = text.slice(0, idx).trim()
  const jsonPart = text.slice(idx + '---JSON---'.length).trim()
  let metrics: Record<string, unknown> = {}
  try {
    const cleaned = jsonPart.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim()
    metrics = JSON.parse(cleaned)
  } catch {
    // ignore — metrics stays empty; html is still useful
  }
  return { html, metrics }
}

// Strip <script> and <style> tags from raw HTML before sending to the model.
// We don't need them — the model just needs the textual content + structure.
// Also drops <head> entirely since none of its content is report data.
function sanitizeHtml(raw: string): string {
  return raw
    .replace(/<head\b[^>]*>[\s\S]*?<\/head>/gi, '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
}

async function pdfToText(dataUrl: string): Promise<string> {
  const base64 = dataUrl.replace(/^data:application\/pdf;base64,/, '')
  const buf = Buffer.from(base64, 'base64')
  // pdf-parse v2 is shipped as ESM; dynamic import keeps this route compatible
  // with the rest of the codebase which is CommonJS-style.
  const mod: any = await import('pdf-parse')
  const pdfParse = mod.default ?? mod
  const result = await pdfParse(buf)
  return String(result?.text ?? '').trim()
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

  // Normalise everything down to a single text payload + a label that tells
  // the model what shape the source was in. PDF goes through pdf-parse first;
  // HTML gets sanitised; markdown is sent both as raw md AND as rendered HTML
  // so the model can pick whichever it parses more cleanly.
  let sourceText: string
  let sourceLabel: string
  try {
    if (parsed.data.kind === 'pdf') {
      sourceText = await pdfToText(parsed.data.dataUrl)
      sourceLabel = 'PDF text extracted via pdf-parse'
      if (!sourceText || sourceText.length < 20) {
        return NextResponse.json({ error: 'Could not extract text from PDF.' }, { status: 400 })
      }
    } else if (parsed.data.kind === 'html') {
      sourceText = sanitizeHtml(parsed.data.content)
      sourceLabel = 'HTML report (style/script tags stripped)'
    } else if (parsed.data.kind === 'markdown') {
      const rendered = await marked.parse(parsed.data.content)
      sourceText = `---RAW MARKDOWN---\n${parsed.data.content}\n\n---RENDERED HTML---\n${rendered}`
      sourceLabel = 'Markdown — both raw + rendered HTML provided'
    } else {
      sourceText = parsed.data.content
      sourceLabel = 'Plain text'
    }
  } catch (err) {
    return NextResponse.json(
      { error: `Could not read source document: ${(err as Error).message ?? 'unknown error'}` },
      { status: 400 },
    )
  }

  // Trim again after PDF/markdown expansion — pdf text can balloon and we
  // don't want to push past the model's context window.
  if (sourceText.length > MAX_CHARS) {
    sourceText = sourceText.slice(0, MAX_CHARS) + '\n\n[…truncated for length…]'
  }

  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  const periodLabel = parsed.data.periodLabel ?? today
  const title = parsed.data.title ?? `Marketing Report — ${today}`

  let raw: string
  try {
    raw = await callLLM(
      [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: USER_INSTRUCTION(today, sourceLabel, sourceText) },
      ],
      { maxTokens: 8192 },
    )
  } catch (err) {
    if (err instanceof MissingLLMKey) {
      return NextResponse.json(
        { error: 'AI report import is not configured. Add ABACUSAI_API_KEY to the server environment.' },
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
      // imgCount stays 0 — this path didn't come from screenshots. The UI
      // already shows "0 img" gracefully, no extra branching needed.
      imgCount: 0,
      notesByChannel: { instagram: '', youtube: '', linkedin: '', website: '' },
    },
  })

  return NextResponse.json({ report: { id: report.id, title: report.title, periodLabel: report.periodLabel } })
}
