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

const BodySchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(2000),
  newType: z.enum(TYPES),
})

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

  const updated = await prisma.linkBuildingItem.updateMany({
    where: {
      id: { in: parsed.data.ids },
      projectId: project.id,
    },
    data: { type: parsed.data.newType },
  })

  return NextResponse.json({ ok: true, updated: updated.count, newType: parsed.data.newType })
}
