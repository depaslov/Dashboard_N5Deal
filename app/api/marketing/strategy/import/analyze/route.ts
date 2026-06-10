import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { marked } from 'marked'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getOrCreateCurrentProject } from '@/lib/project'
import { callLLM, MissingLLMKey } from '@/lib/marketing/llm'
import {
  filterAdditions, countAdditions,
  type StrategyAdditions, type StrategySnapshot,
} from '@/lib/marketing/strategy-merge'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

// 250K-char cap on the incoming doc. Keeps the LLM context bounded and
// protects against multi-MB pastes that wouldn't fit anyway.
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
  const mod: any = await import('pdf-parse')
  const pdfParse = mod.default ?? mod
  const result = await pdfParse(buf)
  return String(result?.text ?? '').trim()
}

const SYSTEM_PROMPT = `You are a structured-data extractor for an N5Deal marketing strategy module. The user pastes a strategy document (HTML / markdown / text). You compare it against the CURRENT strategy JSON the dashboard already has stored and return ONLY the pieces that are MISSING from the current strategy. Never propose anything that already exists at the same key. Output strict valid JSON with no commentary.`

function userPrompt(currentSnapshot: StrategySnapshot, sourceLabel: string, body: string): string {
  return `CURRENT strategy JSON (what's already stored):
\`\`\`json
${JSON.stringify(currentSnapshot, null, 2)}
\`\`\`

NEW DOCUMENT (${sourceLabel}):
\`\`\`
${body}
\`\`\`

Extract structured ADDITIONS from the new document that are NOT already in the current strategy. Output ONLY a single JSON object with this exact shape — every key is OPTIONAL, omit keys with nothing to add. Output ONLY the JSON, no markdown code fences, no explanation:

{
  "budget": {
    "<month>": {  // one of "april" "may" "june" "q3" "q4"
      "<channel>": { "min": <usd>, "max": <usd>, "actual": <usd>, "purpose": "<short description>" }
    }
  },
  "goals": {
    "<channel>": {  // e.g. "instagram" "linkedin" "website" "youtube" "linkBuilding"
      "<metric>": { "baseline": <num>, "target": <num>, "actual": <num>, "unit": "<optional>", "label": "<optional human label>" }
    }
  },
  "channelDirectives": {
    "<channel>": { "title": "<short>", "color": "<tailwind class like bg-blue-500>", "body": "<markdown-friendly text — what to do on this channel>" }
  },
  "currentState": {
    "asOf": "<YYYY-MM-DD or month label>",
    "channels": {
      "<channel>": { "label": "<display label>", "color": "<tailwind class>", "metrics": [{ "label": "<m>", "value": "<v>" }], "diagnosis": "<paragraph>" }
    },
    "gap": "<paragraph describing the 'system gap' narrative>"
  },
  "authorityLayer": {
    "coreShift": "<paragraph>",
    "positioning": "<paragraph>",
    "q3Events": [{ "id": "<slug>", "name": "<event name>", "month": "<month>", "role": "<our role>", "goals": ["<bullet 1>", "<bullet 2>"] }],
    "california": { "name": "<name>", "kind": "<kind>", "positioning": "<text>", "goals": ["<bullet>"] },
    "reportSystem": { "intro": "<text>", "parts": [{ "n": 1, "title": "<title>", "desc": "<desc>" }] },
    "measurement": ["<bullet 1>", "<bullet 2>"]
  }
}

Rules:
1. KEY MATCHING IS LOWERCASE — the same channel under different casing ("Instagram" vs "instagram") is the SAME channel. Always normalize to lowercase camelCase ("linkBuilding" not "Link Building" not "link_building").
2. NEVER propose an item whose key already exists in CURRENT. Example: if current.budget.april.instagram exists, do not output budget.april.instagram.
3. Numbers in currency or quantity context come as plain integers, no commas, no "K"/"M" suffix ("25000" not "25K").
4. Omit a top-level field entirely if you have nothing to add — don't output {} for that section.
5. If the document is unstructured / a wall of prose, do your best to slot quotes into the right slots (e.g., a paragraph about LinkedIn into channelDirectives.linkedin.body); if a fragment doesn't fit any slot, drop it.
6. Output ONLY valid JSON. No "Here is..." preface, no backticks, no notes after.`
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

  // Normalise input → plain text/HTML the LLM can read.
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
    return NextResponse.json({ error: `Could not read source document: ${(err as Error).message ?? 'unknown error'}` }, { status: 400 })
  }
  if (sourceText.length > MAX_CHARS) {
    sourceText = sourceText.slice(0, MAX_CHARS) + '\n\n[…truncated for length…]'
  }

  // Pull current strategy snapshot for the project. If there's no row yet,
  // use the empty snapshot so the LLM treats everything in the doc as new.
  const existing = await prisma.marketingStrategy.findUnique({ where: { projectId: project.id } })
  const currentSnapshot: StrategySnapshot = {
    budget: (existing?.budget as StrategySnapshot['budget']) ?? {},
    goals: (existing?.goals as StrategySnapshot['goals']) ?? {},
    channelDirectives: (existing?.channelDirectives as StrategySnapshot['channelDirectives']) ?? {},
    currentState: (existing?.currentState as StrategySnapshot['currentState']) ?? {},
    authorityLayer: (existing?.authorityLayer as StrategySnapshot['authorityLayer']) ?? {},
  }

  let raw: string
  try {
    raw = await callLLM(
      [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt(currentSnapshot, sourceLabel, sourceText) },
      ],
      { maxTokens: 4096 },
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

  let candidates: StrategyAdditions
  try {
    candidates = JSON.parse(stripJsonFences(raw)) as StrategyAdditions
  } catch {
    return NextResponse.json({
      error: 'LLM returned non-JSON. Try a cleaner source or paste smaller sections.',
      raw: raw.slice(0, 500),
    }, { status: 502 })
  }

  // Deterministic second-pass dedup — never trust the LLM 100%. Filters
  // out anything whose key actually exists in the current snapshot even
  // if the LLM proposed it.
  const additions = filterAdditions(candidates, currentSnapshot)
  const newCount = countAdditions(additions)

  // Also send back the snapshot we used so the UI can show the existing
  // state alongside the proposed additions if it wants to.
  return NextResponse.json({
    additions,
    current: currentSnapshot,
    newCount,
  })
}
