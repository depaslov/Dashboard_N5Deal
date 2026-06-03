import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getOrCreateCurrentProject } from '@/lib/project'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
// Bulk imports can be hundreds of rows. Need more than the default budget.
export const maxDuration = 60

// One post in the import payload. We accept either an `acc` slug ('n5', 'bk',
// 'ih', 'db' — same convention as the Alina prototype) OR an explicit
// `accountId`. The `date` field can be a YYYY-MM-DD or full ISO datetime;
// bare dates get pinned to UTC noon to avoid timezone-shift surprises.
const ImportPostSchema = z.object({
  acc: z.string().optional(),
  accountId: z.string().optional(),
  type: z.string().min(1).max(60),
  title: z.string().min(1).max(500),
  content: z.string().max(20_000).optional().nullable(),
  platforms: z.array(z.string()).default([]),
  date: z.string(),
  status: z.enum(['idea', 'wip', 'done', 'pub', 'skip']).default('idea'),
  notes: z.string().max(5_000).optional().nullable(),
  postUrl: z.string().optional().nullable(),
}).refine((p) => p.acc || p.accountId, {
  message: 'Each post needs `acc` slug or `accountId`',
})

// Accept either a bare array or an object wrapping it.
const BodySchema = z.union([
  z.array(ImportPostSchema),
  z.object({ posts: z.array(ImportPostSchema) }),
])

function parseDate(input: string): Date | null {
  const isoDay = /^\d{4}-\d{2}-\d{2}$/.exec(input.trim())
  if (isoDay) {
    const [y, m, d] = input.trim().split('-').map(Number)
    return new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
  }
  const dt = new Date(input)
  return Number.isNaN(dt.getTime()) ? null : dt
}

interface ImportResult {
  total: number
  inserted: number
  skipped: number
  failed: number
  skippedKeys: string[]   // first 20 skipped (yyyy-mm-dd|title) for the operator
  failures: { index: number; reason: string }[] // first 20 failures
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
  const items = Array.isArray(parsed.data) ? parsed.data : parsed.data.posts
  if (items.length === 0) {
    return NextResponse.json({ error: 'No posts in payload' }, { status: 400 })
  }
  if (items.length > 1000) {
    return NextResponse.json({ error: 'Too many posts in one request — split into batches of ≤1000' }, { status: 400 })
  }

  // Resolve acc/accountId references in one query.
  const accounts = await prisma.socialAccount.findMany({
    where: { projectId: project.id },
    select: { id: true, slug: true },
  })
  const accBySlug = new Map(accounts.map((a) => [a.slug, a.id]))
  const accIds = new Set(accounts.map((a) => a.id))

  // De-dupe key: yyyy-mm-dd|title. Build once from current DB rows so a
  // re-run of the same plan never creates duplicates.
  const dateBounds = items
    .map((p) => parseDate(p.date))
    .filter((d): d is Date => d !== null)
    .sort((a, b) => a.getTime() - b.getTime())
  let existingKeys = new Set<string>()
  if (dateBounds.length > 0) {
    const min = new Date(dateBounds[0].getTime() - 24 * 60 * 60 * 1000)
    const max = new Date(dateBounds[dateBounds.length - 1].getTime() + 24 * 60 * 60 * 1000)
    const existing = await prisma.socialPost.findMany({
      where: {
        projectId: project.id,
        scheduledFor: { gte: min, lte: max },
      },
      select: { title: true, scheduledFor: true },
    })
    existingKeys = new Set(
      existing.map((p) => `${p.scheduledFor.toISOString().slice(0, 10)}|${p.title}`),
    )
  }

  const result: ImportResult = {
    total: items.length,
    inserted: 0,
    skipped: 0,
    failed: 0,
    skippedKeys: [],
    failures: [],
  }

  for (let i = 0; i < items.length; i++) {
    const p = items[i]
    const accountId = p.accountId ?? (p.acc ? accBySlug.get(p.acc) : undefined)
    if (!accountId || !accIds.has(accountId)) {
      result.failed++
      if (result.failures.length < 20) result.failures.push({ index: i, reason: `Unknown account: acc=${p.acc ?? '—'} accountId=${p.accountId ?? '—'}` })
      continue
    }
    const date = parseDate(p.date)
    if (!date) {
      result.failed++
      if (result.failures.length < 20) result.failures.push({ index: i, reason: `Invalid date: "${p.date}"` })
      continue
    }
    const key = `${date.toISOString().slice(0, 10)}|${p.title}`
    if (existingKeys.has(key)) {
      result.skipped++
      if (result.skippedKeys.length < 20) result.skippedKeys.push(key)
      continue
    }
    try {
      await prisma.socialPost.create({
        data: {
          projectId: project.id,
          accountId,
          type: p.type,
          title: p.title,
          content: p.content ?? null,
          platforms: p.platforms,
          scheduledFor: date,
          status: p.status,
          notes: p.notes ?? null,
          postUrl: p.postUrl || null,
          images: undefined,
          createdById: userId,
        },
      })
      result.inserted++
      existingKeys.add(key) // protects against in-payload duplicates
    } catch (err: any) {
      result.failed++
      if (result.failures.length < 20) result.failures.push({ index: i, reason: err?.message?.slice(0, 200) ?? 'create failed' })
    }
  }

  return NextResponse.json(result)
}
