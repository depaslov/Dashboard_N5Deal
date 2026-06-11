import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getOrCreateCurrentProject } from '@/lib/project'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Keep aligned with LB_TYPES — we don't want to accept arbitrary strings
// and end up with type='whatever' rows the constants don't know about.
const TYPES = [
  'task', 'article', 'market_news', 'medium', 'seo',
  'profile', 'web20', 'crowd',
  'outreach', 'guest_post', 'resource', 'partner', 'directory', 'hari', 'other',
] as const

// Two body shapes supported:
//  (1) {ids: [...], newType: 'task'}     — every id gets the SAME newType.
//      Used by quick-actions like "move everything to Tasks".
//  (2) {updates: [{id, newType}, ...]}   — per-row newType, used by the
//      reclassify modal so [SEO]-tagged rows land on 'seo', [Article]
//      rows on 'article', etc., instead of collapsing them all to 'task'.
const BodySchema = z.union([
  z.object({
    ids: z.array(z.string().min(1)).min(1).max(2000),
    newType: z.enum(TYPES),
  }),
  z.object({
    updates: z.array(z.object({
      id: z.string().min(1),
      newType: z.enum(TYPES),
    })).min(1).max(2000),
  }),
])

// Bulk-set the `type` field on many LinkBuildingItem rows in one shot. Used
// by the AI-driven reclassification flow on /marketing/linkbuilding to
// move multiple rows from a link-building type to 'task' (which removes
// them from Link Building and surfaces them on Tasks Andrew).
//
// All ids must belong to a project the caller can access — we enforce
// that with a single `where: { projectId }` clause on updateMany so
// mismatched ids are silently dropped rather than 403'd. The response
// reports the count actually updated so the UI can show "moved N items"
// even when the operator's list contained some they don't own.
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

  if ('ids' in parsed.data) {
    // Single newType for the whole batch — one updateMany call.
    const updated = await prisma.linkBuildingItem.updateMany({
      where: { id: { in: parsed.data.ids }, projectId: project.id },
      data: { type: parsed.data.newType },
    })
    return NextResponse.json({ ok: true, updated: updated.count, newType: parsed.data.newType })
  }

  // Per-row newType — group by newType to keep this to N updateMany calls
  // (one per distinct target type) rather than M individual updates. All
  // wrapped in a single transaction so a mid-flight failure rolls every
  // change back; users either see all the moves or none of them.
  const byNewType = new Map<string, string[]>()
  for (const u of parsed.data.updates) {
    const list = byNewType.get(u.newType) ?? []
    list.push(u.id)
    byNewType.set(u.newType, list)
  }
  const results = await prisma.$transaction(
    [...byNewType.entries()].map(([newType, ids]) =>
      prisma.linkBuildingItem.updateMany({
        where: { id: { in: ids }, projectId: project.id },
        data: { type: newType },
      }),
    ),
  )
  const total = results.reduce((sum, r) => sum + r.count, 0)
  return NextResponse.json({ ok: true, updated: total })
}
