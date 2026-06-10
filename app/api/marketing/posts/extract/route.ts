import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { marked } from 'marked'
import { authOptions } from '@/lib/auth'
import { getOrCreateCurrentProject } from '@/lib/project'
import { prisma } from '@/lib/db'
import { callLLM, MissingLLMKey } from '@/lib/marketing/llm'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

const MAX_CHARS = 250_000

const TextBody = z.object({
  kind: z.enum(['html', 'markdown', 'text']),
  content: z.string().min(20).max(MAX_CHARS),
})
const PdfBody = z.object({
  kind: z.literal('pdf'),
  dataUrl: z.string().regex(/^data:application\/pdf;base64,/),
})
const BodySchema = z.union([TextBody, PdfBody])

// IMPORTANT: unlike other importers we KEEP <script> blocks here. Content-
// plan exports (e.g. the operator's HTML tables built in ChatGPT) routinely
// embed every post as a JS object literal inside a single `<script>` tag
// (the DOM is hydrated at runtime), so stripping scripts would leave the
// LLM staring at an empty `<tbody>` and yield zero posts. We still drop
// <head>, <style>, and HTML comments — they're purely cosmetic and waste
// tokens without carrying post data.
function sanitizeHtml(raw: string): string {
  return raw
    .replace(/<head\b[^>]*>[\s\S]*?<\/head>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
}

async function pdfToText(dataUrl: string): Promise<string> {
  const base64 = dataUrl.replace(/^data:application\/pdf;base64,/, '')
  const buf = Buffer.from(base64, 'base64')
  const mod: any = await import('pdf-parse')
  const pdfParse = mod.default ?? mod
  const result = await pdfParse(buf)
  return String(result?.text ?? '').trim()
}

const SYSTEM_PROMPT = `You extract a structured social-media content calendar from an operator-authored plan (HTML / markdown / text / PDF). Output a JSON array of posts in the EXACT shape the dashboard's bulk-import endpoint accepts. Output ONLY valid JSON, no commentary.`

function userPrompt(
  doc: string,
  sourceLabel: string,
  accounts: { slug: string; name: string }[],
  inferredYear: number,
): string {
  const slugList = accounts.map((a) => `  "${a.slug}" — ${a.name}`).join('\n')
  return `Below is a content plan (${sourceLabel}). Extract every post entry into a JSON array. Output ONLY the JSON, no markdown fences, no prose.

IMPORTANT: the source may embed posts in different shapes. Read all of them:
- A visible HTML table with one row per post
- An inline JavaScript array literal (e.g. \`const P = [ { d: 'Jun 1', hook: '…' }, … ]\`) — common in ChatGPT-exported plan pages where the DOM is hydrated at runtime. Treat entries in this array as posts.
- A markdown list / table with one row per post
- A bare plaintext list with date-prefixed lines
You must extract from whichever shape the source uses. If both a static table and a script-side array exist, the SCRIPT-SIDE array is authoritative (the table is usually a static skeleton).

Each post must have this exact shape:
{
  "acc": "<account slug, see allowed list below>",
  "type": "<post type — see allowed list>",
  "platforms": ["<platform>", ...],
  "title": "<short hook / headline — what shows on the calendar card>",
  "content": "<full body / notes from the source — keep the operator's text intact>",
  "date": "<YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss for posts with a specific time>",
  "status": "idea"
}

Allowed account slugs (use these EXACTLY — pick the closest match based on the source's brand label or pillar):
${slugList}

Allowed post types: "Article" | "Company Post" | "Founder Post" | "Reel" | "Thread" | "Carousel" | "Text Post" | "Repost" | "Story"
Allowed platforms: "LinkedIn" | "LI Company" | "LI Founder" | "Instagram" | "X/Twitter" | "Threads" | "YouTube" | "Medium" | "Newsletter" | "Reddit" | "Telegram" | "Website"

Rules:
1. ONE post per entry in the source. If the source has 90 entries, output 90 objects. Don't merge entries.
2. Brand → acc slug mapping is up to you to infer. E.g. if a post is labelled "Personal" on a founder's plan → that's the founder's personal account slug; "N5Deal" → the company account slug; "BankStore" → its account slug.
3. type:
   - "Carousel" if the source explicitly says carousel
   - "Reel" if explicitly reel/short video
   - "Story" if explicitly story
   - "Article" if it's a long-form article (Medium / newsletter / blog)
   - "Founder Post" if the slug is a founder's personal account AND it's a text post on LinkedIn
   - "Company Post" if it's a company account text post
   - "Text Post" as a generic fallback for short text/mockup
4. platforms: pick the platform(s) the post will appear on. If the source explicitly says "LinkedIn" use ["LinkedIn"]. If it says nothing about platform, default to ["LinkedIn"] for personal/founder posts and ["LinkedIn", "Website"] for company news.
5. title — the hook / headline. The visible card text. Should be a one-line summary of the post's main angle (under 200 chars).
6. content — the full body the operator wrote (the hook + their note explaining angle/intent). Preserve their wording. Multi-line OK.
7. date — if the entry has a year, use it. If not, assume year ${inferredYear}. If the entry has a clock time, output full ISO. If only a date, output YYYY-MM-DD.
8. status is always "idea" — it's a fresh plan.
9. Do NOT include a post that doesn't have BOTH a title hook AND a date. Skip silently.
10. Output the JSON array directly, no { "posts": ... } wrapper. Just [ ... ].

────── PLAN ──────

${doc}`
}

function stripJsonFences(text: string): string {
  return text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim()
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
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid fields' }, { status: 400 })
  }

  // Pull the project's account slugs so the LLM uses the exact strings the
  // bulk-import endpoint will recognise — avoids an extra "your acc 'ih'
  // is unknown" failure round-trip.
  const accounts = await prisma.socialAccount.findMany({
    where: { projectId: project.id },
    select: { slug: true, name: true },
    orderBy: { slug: 'asc' },
  })

  // Normalise to plain text/HTML for the LLM.
  let sourceText: string
  let sourceLabel: string
  try {
    if (parsed.data.kind === 'pdf') {
      sourceText = await pdfToText(parsed.data.dataUrl)
      sourceLabel = 'PDF (text extracted via pdf-parse)'
      if (!sourceText || sourceText.length < 20) {
        return NextResponse.json({ error: 'Could not extract text from PDF.' }, { status: 400 })
      }
    } else if (parsed.data.kind === 'html') {
      sourceText = sanitizeHtml(parsed.data.content)
      sourceLabel = 'HTML (style/script stripped)'
    } else if (parsed.data.kind === 'markdown') {
      const rendered = await marked.parse(parsed.data.content)
      sourceText = `---RAW MARKDOWN---\n${parsed.data.content}\n\n---RENDERED HTML---\n${rendered}`
      sourceLabel = 'Markdown (raw + rendered HTML)'
    } else {
      sourceText = parsed.data.content
      sourceLabel = 'Plain text'
    }
  } catch (err) {
    return NextResponse.json({ error: `Could not read source document: ${(err as Error).message ?? 'unknown'}` }, { status: 400 })
  }
  if (sourceText.length > MAX_CHARS) {
    sourceText = sourceText.slice(0, MAX_CHARS) + '\n\n[…truncated for length…]'
  }

  const inferredYear = new Date().getFullYear()

  let raw: string
  try {
    raw = await callLLM(
      [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt(sourceText, sourceLabel, accounts, inferredYear) },
      ],
      // 90-post plans easily exceed 8K output tokens once `content` keeps
      // the full hook + operator note. Bumped to 16K — comfortably fits a
      // monthly calendar for a single founder.
      { maxTokens: 16384 },
    )
  } catch (err) {
    if (err instanceof MissingLLMKey) {
      return NextResponse.json(
        { error: 'AI is not configured. Add ABACUSAI_API_KEY to the server environment.' },
        { status: 503 },
      )
    }
    return NextResponse.json({ error: (err as Error).message ?? 'LLM call failed' }, { status: 502 })
  }

  let posts: unknown
  try {
    const cleaned = stripJsonFences(raw)
    posts = JSON.parse(cleaned)
  } catch {
    return NextResponse.json({
      error: 'LLM returned non-JSON. Try a cleaner source.',
      raw: raw.slice(0, 500),
    }, { status: 502 })
  }
  if (!Array.isArray(posts)) {
    return NextResponse.json({ error: 'LLM did not return an array.' }, { status: 502 })
  }

  return NextResponse.json({ posts, accounts })
}
