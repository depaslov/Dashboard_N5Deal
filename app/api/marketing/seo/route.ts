import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getOrCreateCurrentProject } from '@/lib/project'

export const dynamic = 'force-dynamic'

const INTENTS = ['informational', 'commercial', 'transactional', 'navigational'] as const

const CreateSchema = z.object({
  keyword: z.string().min(1).max(300),
  targetUrl: z.string().max(500).optional().nullable(),
  currentUrl: z.string().max(500).optional().nullable(),
  position: z.number().int().min(1).max(200).optional().nullable(),
  impressions: z.number().int().nonnegative().optional().nullable(),
  clicks: z.number().int().nonnegative().optional().nullable(),
  volume: z.number().int().nonnegative().optional().nullable(),
  difficulty: z.number().int().min(0).max(100).optional().nullable(),
  cluster: z.string().max(100).optional().nullable(),
  intent: z.enum(INTENTS).default('informational'),
  locale: z.string().max(20).default('global'),
  isActive: z.boolean().default(true),
  notes: z.string().max(5_000).optional().nullable(),
})

// Bulk create — for paste-importing many keywords at once.
const BulkSchema = z.object({
  items: z.array(CreateSchema).min(1).max(500),
})

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id as string | undefined
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const project = await getOrCreateCurrentProject(userId)
  const { searchParams } = new URL(req.url)
  const cluster = searchParams.get('cluster') ?? undefined
  const intent = searchParams.get('intent') ?? undefined

  const items = await prisma.seoKeyword.findMany({
    where: {
      projectId: project.id,
      ...(cluster ? { cluster } : {}),
      ...(intent ? { intent } : {}),
    },
    orderBy: [{ position: 'asc' }, { keyword: 'asc' }],
  })
  return NextResponse.json({ items })
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

  // Bulk mode: { items: [...] }
  if (body && typeof body === 'object' && 'items' in (body as Record<string, unknown>)) {
    const parsed = BulkSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid fields' }, { status: 400 })
    }
    let created = 0
    let updated = 0
    for (const it of parsed.data.items) {
      const existing = await prisma.seoKeyword.findUnique({
        where: { projectId_keyword: { projectId: project.id, keyword: it.keyword } },
      })
      const data = {
        targetUrl: it.targetUrl || null,
        currentUrl: it.currentUrl || null,
        position: it.position ?? null,
        previousPosition: existing?.position ?? null,
        impressions: it.impressions ?? null,
        clicks: it.clicks ?? null,
        volume: it.volume ?? null,
        difficulty: it.difficulty ?? null,
        cluster: it.cluster || null,
        intent: it.intent,
        locale: it.locale,
        isActive: it.isActive,
        notes: it.notes || null,
        lastChecked: it.position !== null && it.position !== undefined ? new Date() : existing?.lastChecked ?? null,
      }
      await prisma.seoKeyword.upsert({
        where: { projectId_keyword: { projectId: project.id, keyword: it.keyword } },
        create: { projectId: project.id, keyword: it.keyword, createdById: userId, ...data },
        update: data,
      })
      if (existing) updated++; else created++
    }
    return NextResponse.json({ created, updated })
  }

  // Single create
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid fields' }, { status: 400 })
  }
  try {
    const item = await prisma.seoKeyword.create({
      data: {
        projectId: project.id,
        createdById: userId,
        keyword: parsed.data.keyword,
        targetUrl: parsed.data.targetUrl || null,
        currentUrl: parsed.data.currentUrl || null,
        position: parsed.data.position ?? null,
        impressions: parsed.data.impressions ?? null,
        clicks: parsed.data.clicks ?? null,
        volume: parsed.data.volume ?? null,
        difficulty: parsed.data.difficulty ?? null,
        cluster: parsed.data.cluster || null,
        intent: parsed.data.intent,
        locale: parsed.data.locale,
        isActive: parsed.data.isActive,
        notes: parsed.data.notes || null,
        lastChecked: parsed.data.position !== null && parsed.data.position !== undefined ? new Date() : null,
      },
    })
    return NextResponse.json({ item })
  } catch (err: unknown) {
    const msg = (err as { message?: string })?.message ?? 'Create failed'
    if (msg.includes('Unique constraint')) {
      return NextResponse.json({ error: 'This keyword is already tracked in the workspace' }, { status: 409 })
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
