import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getOrCreateCurrentProject } from '@/lib/project'
import { callLLM, MissingLLMKey } from '@/lib/marketing/llm'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 120

// Reads all non-task LinkBuildingItem rows for the current project and
// asks the LLM to flag the ones that aren't really link-building work —
// the operator may have dropped general TODOs in here before the Tasks
// Andrew page existed, or with type='other' that has nothing to do with
// outreach. Returns proposed reclassifications; the bulk-set-type
// endpoint is what actually writes them.
//
// One LLM call for the whole project (instead of one per row) — keeps the
// cost down and lets the model see the rest of the list when deciding
// whether something is an outlier.

const SYSTEM_PROMPT = `You classify backlog items as either real link-building activities (outreach, guest post, resource page, partner placement, directory listing, profile link, Web 2.0, crowd marketing, Medium article, site article, market news, HARO/press) OR general tasks (anything that isn't trying to earn a backlink — research, design, admin, planning, follow-up reminders, internal coordination, etc.). Output strict JSON.`

interface ItemForClassify {
  id: string
  title: string
  type: string
  targetSite: string | null
  anchorText: string | null
  destinationUrl: string | null
  liveUrl: string | null
  notes: string | null
}

function userPrompt(items: ItemForClassify[]): string {
  return `Below is the link-building backlog for an N5Deal marketing project. Some items aren't actually about earning backlinks — they're general tasks. Identify those.

Output a JSON object with this exact shape:
{
  "verdicts": [
    { "id": "<row id>", "currentType": "<current type>", "suggestedType": "task" | "<keep current>", "reason": "<one sentence on why>" }
  ]
}

Rules:
1. INCLUDE every input row in the output. If you'd keep it as a link-building activity, set "suggestedType" to the SAME value as "currentType".
2. Mark as "task" only when the item clearly isn't trying to earn a backlink. Strong signals: no target site, no destination URL, no anchor text, the title describes internal work ("write content brief", "review SEO report", "prepare deck for X meeting", "Q3 planning", "audit links"), or the notes are about scheduling / decisions / reminders rather than outreach.
3. When in doubt, KEEP it as a link-building activity. Only flip when you're confident.
4. "reason" stays under 100 chars and is specific to that row's evidence.
5. Output ONLY the JSON object. No markdown fences, no prose.

────── BACKLOG ──────

${JSON.stringify(items, null, 2)}`
}

function stripJsonFences(text: string): string {
  return text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim()
}

export async function POST() {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id as string | undefined
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const project = await getOrCreateCurrentProject(userId)

  const rows = await prisma.linkBuildingItem.findMany({
    where: { projectId: project.id, NOT: { type: 'task' } },
    select: {
      id: true,
      title: true,
      type: true,
      targetSite: true,
      anchorText: true,
      destinationUrl: true,
      liveUrl: true,
      notes: true,
    },
    orderBy: { createdAt: 'asc' },
  })

  if (rows.length === 0) {
    return NextResponse.json({ items: [], proposed: [], totalProposed: 0 })
  }

  // Trim notes to keep prompt size bounded — most of the signal lives in
  // the title + targetSite/anchor/destination columns.
  const trimmed: ItemForClassify[] = rows.map((r) => ({
    id: r.id,
    title: r.title,
    type: r.type,
    targetSite: r.targetSite,
    anchorText: r.anchorText,
    destinationUrl: r.destinationUrl,
    liveUrl: r.liveUrl,
    notes: r.notes?.slice(0, 400) ?? null,
  }))

  let raw: string
  try {
    raw = await callLLM(
      [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt(trimmed) },
      ],
      { maxTokens: 8192 },
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

  let verdicts: Array<{ id: string; currentType: string; suggestedType: string; reason: string }>
  try {
    const parsed = JSON.parse(stripJsonFences(raw))
    verdicts = Array.isArray(parsed?.verdicts) ? parsed.verdicts : []
  } catch {
    return NextResponse.json({
      error: 'LLM returned non-JSON. Try again.',
      raw: raw.slice(0, 500),
    }, { status: 502 })
  }

  // Build the response: for each row, include the LLM's verdict + the row's
  // own fields so the UI can render a meaningful preview without a second
  // round-trip. Only rows where suggestedType === 'task' are surfaced as
  // "proposed migrations"; the rest are returned for context but the UI
  // doesn't have to pre-tick them.
  const byId = new Map(rows.map((r) => [r.id, r]))
  const enriched = verdicts
    .map((v) => {
      const r = byId.get(v.id)
      if (!r) return null
      return {
        id: r.id,
        title: r.title,
        currentType: r.type,
        suggestedType: v.suggestedType === 'task' ? 'task' : r.type,
        flagged: v.suggestedType === 'task',
        reason: (v.reason ?? '').slice(0, 200),
        targetSite: r.targetSite,
      }
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)

  const proposed = enriched.filter((e) => e.flagged)

  return NextResponse.json({
    items: enriched,
    proposed,
    totalProposed: proposed.length,
    totalScanned: rows.length,
  })
}
