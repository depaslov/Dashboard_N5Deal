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

// Google Docs HTML importer has TWO quirks that drive the choices below:
//   1) `font-family` declared on <body> doesn't reliably inherit to nested
//      block elements — Docs assigns the Doc's default font (often Times
//      New Roman) to elements that don't carry an explicit family.
//   2) Inline `style="…"` attributes are honoured more consistently than
//      stylesheet rules in <style>. Some CSS that survives in <style> is
//      lost on inline elements unless restated.
// So we (a) put `font-family: Arial, sans-serif` on EVERY block rule, and
// (b) wrap the imported body in an inline-styled <div> as a defensive
// second layer. The `code` / `pre` rules are the only exception — those
// keep monospace because that's what they should be in a Doc too.

const ARIAL = 'Arial, Helvetica, sans-serif'

// Inline-styled wrapper applied at the outermost level — second line of
// defence for elements whose family Docs would otherwise reset to Times.
function withRootWrapper(body: string): string {
  return `<div style="font-family: ${ARIAL}; color: #111827; line-height: 1.6;">${body}</div>`
}

// Inline-style strong / b tags so the bold survives Google Docs' import
// flattening. <strong> alone is supposed to be enough (Docs recognises
// the semantic), but in practice when a <strong> is nested inside a <p>
// that carries an explicit font-family inline style, Docs sometimes
// resolves the weight from the parent's "regular" Arial entry and drops
// the bold. The inline style="font-weight:700;..." on the tag itself
// stays put because Docs honours inline styles before stylesheet ones.
// Re-asserting font-family inside the tag prevents the importer from
// falling back to Times New Roman for the bolded run only.
function inlineBoldStyles(html: string): string {
  return html
    .replace(/<strong(\s[^>]*)?>/gi, (_m, attrs) => `<strong${attrs ?? ''} style="font-weight:700;font-family:${ARIAL};">`)
    .replace(/<b(\s[^>]*)?>/gi, (_m, attrs) => `<b${attrs ?? ''} style="font-weight:700;font-family:${ARIAL};">`)
    .replace(/<em(\s[^>]*)?>/gi, (_m, attrs) => `<em${attrs ?? ''} style="font-style:italic;font-family:${ARIAL};">`)
    .replace(/<i(\s[^>]*)?>/gi, (_m, attrs) => `<i${attrs ?? ''} style="font-style:italic;font-family:${ARIAL};">`)
}

// Inline stylesheet wrapped around REPORT HTML (from the dashboard
// reports module). Google Docs preserves font weight/size/color, padding,
// borders, table layout, and block backgrounds — enough that the imported
// Doc looks like the dashboard view, not a wall of plain text. display:grid
// and box-shadow get stripped on import; that's expected.
function wrapReportHtml(title: string, body: string): string {
  const safeTitle = title.replace(/[<>]/g, '')
  const css = `
    body { font-family: ${ARIAL}; color: #111827; }
    div, p, span, li, td, th { font-family: ${ARIAL}; }
    h1 { font-family: ${ARIAL}; font-size: 22pt; font-weight: 700; color: #111827; }
    h2 { font-family: ${ARIAL}; font-size: 16pt; font-weight: 700; margin-top: 18pt; color: #111827; }
    h3 { font-family: ${ARIAL}; font-size: 10pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #6B7280; margin-top: 12pt; }
    .rp { font-family: ${ARIAL}; font-size: 10pt; color: #6B7280; margin-bottom: 12pt; }
    .mg { font-family: ${ARIAL}; margin: 8pt 0; }
    .mc { font-family: ${ARIAL}; display: inline-block; min-width: 130pt; background: #F4F5F7; border: 1px solid #E5E7EB; padding: 8pt 12pt; margin: 4pt; text-align: center; vertical-align: top; }
    .mv { font-family: ${ARIAL}; font-size: 18pt; font-weight: 700; color: #111827; }
    .ml { font-family: ${ARIAL}; font-size: 8pt; color: #6B7280; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; }
    .md { font-family: ${ARIAL}; font-size: 9pt; font-weight: 600; }
    .md.up { font-family: ${ARIAL}; color: #059669; font-size: 9pt; font-weight: 600; }
    .md.dn { font-family: ${ARIAL}; color: #DC2626; font-size: 9pt; font-weight: 600; }
    .md.nu { font-family: ${ARIAL}; color: #6B7280; font-size: 9pt; font-weight: 600; }
    .ins { font-family: ${ARIAL}; background: #EEF4FF; border-left: 3px solid #2563EB; padding: 8pt 12pt; margin: 8pt 0; font-size: 11pt; color: #111827; }
    .ins.warn { background: #FEF3C7; border-left-color: #D97706; }
    .ins.alert { background: #FEE2E2; border-left-color: #DC2626; }
    .ins.win { background: #D1FAE5; border-left-color: #059669; }
    ul, ol { font-family: ${ARIAL}; padding-left: 24pt; }
    li { font-family: ${ARIAL}; margin: 4pt 0; font-size: 11pt; }
    strong, b { font-family: ${ARIAL}; font-weight: 700; }
    em, i { font-family: ${ARIAL}; font-style: italic; }
    a { font-family: ${ARIAL}; color: #2563EB; text-decoration: underline; }
    table { font-family: ${ARIAL}; width: 100%; border-collapse: collapse; margin: 8pt 0; font-size: 10pt; }
    th { font-family: ${ARIAL}; background: #F4F5F7; text-align: left; padding: 6pt 8pt; border-bottom: 1px solid #E5E7EB; font-size: 9pt; font-weight: 700; color: #6B7280; text-transform: uppercase; letter-spacing: 0.04em; }
    td { font-family: ${ARIAL}; padding: 6pt 8pt; border-bottom: 1px solid #E5E7EB; color: #111827; }
  `
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${safeTitle}</title><style>${css}</style></head><body>${withRootWrapper(inlineBoldStyles(body))}</body></html>`
}

// Wrap ARTICLE HTML (from markdown) — prose + headings + lists + inline
// emphasis. Arial throughout per operator request (was Georgia before, but
// the dashboard's editorial preference is sans-serif). code / pre stay
// monospace because that's the conventional formatting for those tokens.
function wrapArticleHtml(title: string, body: string): string {
  const safeTitle = title.replace(/[<>]/g, '')
  const css = `
    body { font-family: ${ARIAL}; color: #111827; line-height: 1.6; }
    div, p, span, li, td, th, blockquote { font-family: ${ARIAL}; }
    h1 { font-family: ${ARIAL}; font-size: 24pt; font-weight: 700; margin-bottom: 4pt; color: #111827; }
    h2 { font-family: ${ARIAL}; font-size: 16pt; font-weight: 700; margin-top: 18pt; color: #111827; }
    h3 { font-family: ${ARIAL}; font-size: 13pt; font-weight: 700; margin-top: 12pt; color: #111827; }
    h4 { font-family: ${ARIAL}; font-size: 11pt; font-weight: 700; margin-top: 10pt; color: #111827; }
    p { font-family: ${ARIAL}; margin: 8pt 0; font-size: 12pt; color: #111827; }
    strong, b { font-family: ${ARIAL}; font-weight: 700; }
    em, i { font-family: ${ARIAL}; font-style: italic; }
    ul, ol { font-family: ${ARIAL}; padding-left: 24pt; }
    li { font-family: ${ARIAL}; margin: 4pt 0; font-size: 12pt; color: #111827; }
    blockquote { font-family: ${ARIAL}; border-left: 3pt solid #E5E7EB; padding-left: 12pt; color: #6B7280; margin: 8pt 0; font-style: italic; }
    code { font-family: 'Courier New', Courier, monospace; background: #F4F5F7; padding: 1pt 4pt; font-size: 11pt; }
    pre { font-family: 'Courier New', Courier, monospace; background: #F4F5F7; padding: 8pt; font-size: 10pt; white-space: pre-wrap; }
    a { font-family: ${ARIAL}; color: #2563EB; text-decoration: underline; }
    hr { border: 0; border-top: 1pt solid #E5E7EB; margin: 12pt 0; }
    table { font-family: ${ARIAL}; width: 100%; border-collapse: collapse; margin: 8pt 0; font-size: 11pt; }
    th { font-family: ${ARIAL}; background: #F4F5F7; text-align: left; padding: 6pt 8pt; border-bottom: 1px solid #E5E7EB; font-weight: 700; color: #6B7280; }
    td { font-family: ${ARIAL}; padding: 6pt 8pt; border-bottom: 1px solid #E5E7EB; color: #111827; }
  `
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${safeTitle}</title><style>${css}</style></head><body>${withRootWrapper(inlineBoldStyles(body))}</body></html>`
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
