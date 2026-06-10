import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import {
  createGoogleDoc,
  getValidAccessToken,
  GoogleNotConfiguredError,
  GoogleNotConnectedError,
} from '@/lib/google/oauth'
import { renderMarkdown } from '@/lib/markdown'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

// Two input modes:
//   1) `html` — already-formatted HTML (the Reports module sends this; it's
//      the rendered dashboard report). Drive converts to Doc directly.
//   2) `markdown` — content module's source format. We render to HTML via
//      the shared `renderMarkdown` helper (same `marked` parser used for
//      the dashboard preview) before sending to Drive.
//
// Title is required so the Doc lands with a sensible name in the operator's
// Drive list. Max 200 chars matches Google's own filename limit + sane UI.
const BodySchema = z.union([
  z.object({
    kind: z.literal('html'),
    title: z.string().min(1).max(200),
    html: z.string().min(1).max(500_000),
  }),
  z.object({
    kind: z.literal('markdown'),
    title: z.string().min(1).max(200),
    markdown: z.string().min(1).max(500_000),
  }),
])

// Inline stylesheet wrapped around report HTML so the Google Doc inherits
// the dashboard's visual structure (headings, metric cards, insight blocks,
// table styling). Google Docs strips display:grid and a lot of CSS on
// import, but it DOES preserve font weight, font size, color, padding,
// borders, table layout, and block backgrounds — enough that the imported
// Doc looks like the dashboard view, not a wall of plain text.
function wrapReportHtml(title: string, body: string): string {
  const safeTitle = title.replace(/[<>]/g, '')
  const css = `
    body { font-family: Arial, sans-serif; color: #111827; }
    h1 { font-size: 22pt; font-weight: 700; }
    h2 { font-size: 16pt; font-weight: 700; margin-top: 18pt; }
    h3 { font-size: 10pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #6B7280; margin-top: 12pt; }
    .rp { font-size: 10pt; color: #6B7280; margin-bottom: 12pt; }
    .mg { margin: 8pt 0; }
    .mc { display: inline-block; min-width: 130pt; background: #F4F5F7; border: 1px solid #E5E7EB; padding: 8pt 12pt; margin: 4pt; text-align: center; vertical-align: top; }
    .mv { font-size: 18pt; font-weight: 700; }
    .ml { font-size: 8pt; color: #6B7280; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; }
    .md.up { color: #059669; font-size: 9pt; font-weight: 600; }
    .md.dn { color: #DC2626; font-size: 9pt; font-weight: 600; }
    .ins { background: #EEF4FF; border-left: 3px solid #2563EB; padding: 8pt 12pt; margin: 8pt 0; font-size: 11pt; }
    table { width: 100%; border-collapse: collapse; margin: 8pt 0; font-size: 10pt; }
    th { background: #F4F5F7; text-align: left; padding: 6pt 8pt; border-bottom: 1px solid #E5E7EB; font-size: 9pt; font-weight: 700; color: #6B7280; text-transform: uppercase; letter-spacing: 0.04em; }
    td { padding: 6pt 8pt; border-bottom: 1px solid #E5E7EB; }
  `
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${safeTitle}</title><style>${css}</style></head><body>${body}</body></html>`
}

// Wrap article HTML (from markdown) — simpler styling than reports since
// articles are mostly prose + headings + lists + inline emphasis. We pad
// h1/h2/h3 sizing so the imported Doc matches an editorial article look.
function wrapArticleHtml(title: string, body: string): string {
  const safeTitle = title.replace(/[<>]/g, '')
  const css = `
    body { font-family: Georgia, 'Times New Roman', serif; color: #111827; line-height: 1.6; }
    h1 { font-size: 24pt; font-weight: 700; margin-bottom: 4pt; font-family: Arial, sans-serif; }
    h2 { font-size: 16pt; font-weight: 700; margin-top: 18pt; font-family: Arial, sans-serif; }
    h3 { font-size: 13pt; font-weight: 700; margin-top: 12pt; font-family: Arial, sans-serif; }
    p { margin: 8pt 0; font-size: 12pt; }
    strong { font-weight: 700; }
    em { font-style: italic; }
    ul, ol { padding-left: 24pt; }
    li { margin: 4pt 0; font-size: 12pt; }
    blockquote { border-left: 3pt solid #E5E7EB; padding-left: 12pt; color: #6B7280; margin: 8pt 0; }
    code { font-family: 'Courier New', monospace; background: #F4F5F7; padding: 1pt 4pt; font-size: 11pt; }
    pre { background: #F4F5F7; padding: 8pt; font-family: 'Courier New', monospace; font-size: 10pt; }
    a { color: #2563EB; text-decoration: underline; }
    hr { border: 0; border-top: 1pt solid #E5E7EB; margin: 12pt 0; }
  `
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${safeTitle}</title><style>${css}</style></head><body>${body}</body></html>`
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id as string | undefined
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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

  let accessToken: string
  try {
    accessToken = await getValidAccessToken(userId)
  } catch (err) {
    if (err instanceof GoogleNotConfiguredError) {
      return NextResponse.json({ error: err.message, code: 'not_configured' }, { status: 503 })
    }
    if (err instanceof GoogleNotConnectedError) {
      return NextResponse.json({ error: 'Google account not connected.', code: 'not_connected' }, { status: 403 })
    }
    return NextResponse.json(
      { error: `Could not get Google access token: ${(err as Error).message ?? 'unknown'}`, code: 'token_error' },
      { status: 502 },
    )
  }

  let fullHtml: string
  if (parsed.data.kind === 'html') {
    fullHtml = wrapReportHtml(parsed.data.title, parsed.data.html)
  } else {
    const rendered = renderMarkdown(parsed.data.markdown)
    fullHtml = wrapArticleHtml(parsed.data.title, rendered)
  }

  try {
    const { docId, docUrl } = await createGoogleDoc(accessToken, parsed.data.title, fullHtml)
    return NextResponse.json({ docId, docUrl })
  } catch (err) {
    return NextResponse.json(
      { error: `Drive create failed: ${(err as Error).message ?? 'unknown'}` },
      { status: 502 },
    )
  }
}
