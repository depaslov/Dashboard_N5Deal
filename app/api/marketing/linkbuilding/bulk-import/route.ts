import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getOrCreateCurrentProject } from '@/lib/project'
import { LB_TYPES, LB_STATUSES } from '@/lib/marketing/constants'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

const TYPE_SET: Set<string> = new Set(LB_TYPES.map((t) => t.k))
const STATUS_SET: Set<string> = new Set(LB_STATUSES.map((s) => s.k))

const ImportSchema = z.object({
  date: z.string(),
  type: z.string(),
  title: z.string().max(300).optional(),
  status: z.string().optional(),
  targetSite: z.string().max(300).optional().nullable(),
  contactName: z.string().max(200).optional().nullable(),
  contactEmail: z.string().max(200).optional().nullable(),
  anchorText: z.string().max(300).optional().nullable(),
  destinationUrl: z.string().max(500).optional().nullable(),
  liveUrl: z.string().max(500).optional().nullable(),
  publishedDate: z.string().optional().nullable(),
  dr: z.number().int().min(0).max(100).optional().nullable(),
  cost: z.number().min(0).optional().nullable(),
  notes: z.string().max(5_000).optional().nullable(),
})

const BodySchema = z.union([
  z.array(ImportSchema),
  z.object({ items: z.array(ImportSchema) }),
])

function parseDate(input: string): Date | null {
  const isoDay = /^\d{4}-\d{2}-\d{2}$/.exec(input.trim())
  if (isoDay) {
    const [y, m, d] = input.trim().split('-').map(Number)
    return new Date(Date.UTC(y, m - 1, d, 9, 0, 0))
  }
  const dt = new Date(input)
  return Number.isNaN(dt.getTime()) ? null : dt
}

// Human-readable fallback title when the payload doesn't supply one.
// Mirrors the seed script's title format so re-imports match exactly.
const TYPE_LABELS: Record<string, string> = Object.fromEntries(LB_TYPES.map((t) => [t.k, t.label]))
function autoTitle(type: string, date: Date): string {
  const dd = date.toISOString().slice(0, 10).split('-').reverse().slice(0, 2).join('.')
  return `${TYPE_LABELS[type] ?? type} — ${dd}`
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
    return NextResponse.json({
      error: parsed.error.issues[0]?.message ?? 'Invalid payload',
      issues: parsed.error.issues.slice(0, 5),
    }, { status: 400 })
  }
  const items = Array.isArray(parsed.data) ? parsed.data : parsed.data.items
  if (items.length === 0) return NextResponse.json({ error: 'No items in payload' }, { status: 400 })
  if (items.length > 1000) return NextResponse.json({ error: 'Too many items — split into batches of ≤1000' }, { status: 400 })

  // Existing rows in the same date window for idempotency.
  const dateBounds = items
    .map((p) => parseDate(p.date))
    .filter((d): d is Date => d !== null)
    .sort((a, b) => a.getTime() - b.getTime())
  let existingKeys = new Set<string>()
  if (dateBounds.length > 0) {
    const min = new Date(dateBounds[0].getTime() - 24 * 60 * 60 * 1000)
    const max = new Date(dateBounds[dateBounds.length - 1].getTime() + 24 * 60 * 60 * 1000)
    const existing = await prisma.linkBuildingItem.findMany({
      where: { projectId: project.id, scheduledFor: { gte: min, lte: max } },
      select: { title: true, scheduledFor: true },
    })
    existingKeys = new Set(existing.map((e) => `${e.scheduledFor.toISOString().slice(0, 10)}|${e.title}`))
  }

  const result = {
    total: items.length,
    inserted: 0,
    skipped: 0,
    failed: 0,
    skippedKeys: [] as string[],
    failures: [] as { index: number; reason: string }[],
  }

  for (let i = 0; i < items.length; i++) {
    const p = items[i]
    if (!TYPE_SET.has(p.type)) {
      result.failed++
      if (result.failures.length < 20) result.failures.push({ index: i, reason: `Unknown type: "${p.type}". Allowed: ${[...TYPE_SET].join(', ')}` })
      continue
    }
    const date = parseDate(p.date)
    if (!date) {
      result.failed++
      if (result.failures.length < 20) result.failures.push({ index: i, reason: `Invalid date: "${p.date}"` })
      continue
    }
    const status = p.status && STATUS_SET.has(p.status) ? p.status : 'planned'
    const title = (p.title ?? autoTitle(p.type, date)).trim()
    const key = `${date.toISOString().slice(0, 10)}|${title}`
    if (existingKeys.has(key)) {
      result.skipped++
      if (result.skippedKeys.length < 20) result.skippedKeys.push(key)
      continue
    }
    try {
      await prisma.linkBuildingItem.create({
        data: {
          projectId: project.id,
          title,
          type: p.type,
          status,
          scheduledFor: date,
          targetSite: p.targetSite ?? null,
          contactName: p.contactName ?? null,
          contactEmail: p.contactEmail ?? null,
          anchorText: p.anchorText ?? null,
          destinationUrl: p.destinationUrl ?? null,
          liveUrl: p.liveUrl ?? null,
          publishedDate: p.publishedDate ? parseDate(p.publishedDate) : null,
          dr: p.dr ?? null,
          cost: p.cost ?? null,
          notes: p.notes ?? null,
          createdById: userId,
        },
      })
      result.inserted++
      existingKeys.add(key)
    } catch (err: any) {
      result.failed++
      if (result.failures.length < 20) result.failures.push({ index: i, reason: err?.message?.slice(0, 200) ?? 'create failed' })
    }
  }

  return NextResponse.json(result)
}
