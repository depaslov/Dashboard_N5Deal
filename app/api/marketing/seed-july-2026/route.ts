import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getOrCreateCurrentProject } from '@/lib/project'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// ────────────────────────────────────────────────────────────────────────────
// Seed the July 2026 posting plan into LinkBuildingItem records so it shows
// up on /marketing/tasks and /marketing/linkbuilding. Idempotent — a signature
// notes-marker on every seeded row lets us detect prior seeds and either
// short-circuit (default) or purge + reseed (?force).
//
// Split (matches the plan on /reports/2026-07-plan):
//   Tasks board (task-like types → /marketing/tasks):
//     25 × 'article'      — Site articles for n5deal.com/blog
//     10 × 'medium'       — Medium articles (WEB 2.0 backlinks land there)
//      6 × 'market_news'  — Topical rephrase pieces
//                            = 41 items on the Tasks board.
//
//   LinkBuilding board (real placement types → /marketing/linkbuilding):
//     10 × 'profile'      — Profile placements on DR-donors
//     12 × 'crowd'        — Reddit responses (after warmup)
//      3 × 'outreach'     — Paid outreach (PRNews.io etc.)
//                            = 25 items on the LinkBuilding board.
//
// Total: 66 items.
//
// Title format matches June's convention: `${Label} — DD.07`. Rich topic
// details go into `notes` so the board cards stay compact but hover shows
// the theme.
// ────────────────────────────────────────────────────────────────────────────

const SEED_MARKER = '[Auto-seeded: July 2026 plan]'

type TypeExtras = Partial<{
  targetSite: string
  anchorText: string
  destinationUrl: string
  dr: number
  cost: number
}>

type TypeSpec = {
  type: string
  label: string
  // items per week — [W1, W2, W3, W4, W5]
  weeklyCounts: [number, number, number, number, number]
  // optional topic per index in the order items are created; used in notes
  topics?: string[]
  extras?: TypeExtras
}

const SPECS: TypeSpec[] = [
  {
    type: 'article',
    label: 'Site article (n5deal.com)',
    weeklyCounts: [6, 6, 6, 5, 2],
    topics: [
      // W1 (6) — Series 2 continuation
      'Series 2 — MiCA deep-dive (post-July-1 impact)',
      'Series 2 — EMI vs PI: practical differences',
      'Series 2 — Capital requirements by jurisdiction',
      'Series 2 — Passporting after MiCA: what still works',
      'Series 2 — MSB Canada: underrated gateway',
      'Series 2 — FCA vs CBI: updated for Q3 2026',
      // W2 (6) — start Series 3 case studies
      'Series 3 — Case study: Revolut licensing path',
      'Series 3 — Case study: Wise cross-border deal',
      'Series 2 — Fintech M&A timeline reality check',
      'Series 3 — Case study: distressed EMI turnaround',
      'Series 2 — How buyers value a licence',
      'Series 3 — Case study: failed VASP transition',
      // W3 (6)
      'Series 2 — Earn-outs in fintech M&A',
      'Series 3 — Case study: bank licence acquisition',
      'Series 2 — Regulatory fines and valuation impact',
      'Series 3 — Case study: MiCA-driven consolidation',
      'Series 2 — Information memorandum essentials',
      'Series 3 — Case study: cross-border EU-Gulf deal',
      // W4 (5)
      'Series 2 — Compliance function as an M&A asset',
      'Series 3 — Case study: Netherlands DNB advantage',
      'Series 2 — What kills fintech deals at LOI',
      'Series 3 — Case study: Hong Kong stablecoin',
      'Series 2 — Post-Brexit UK licensing map',
      // W5 (2)
      'Series 2 — Q2 2026 fintech M&A recap (data)',
      'Series 3 — Case study: successful earn-out close',
    ],
  },
  {
    type: 'medium',
    label: 'Medium article',
    weeklyCounts: [3, 2, 2, 2, 1],
    topics: [
      // W1 (3) — carry-over from June's 3 unpublished
      'Republish June carry-over #1 (WEB 2.0)',
      'Republish June carry-over #2 (WEB 2.0)',
      'Republish June carry-over #3 (WEB 2.0)',
      // W2 (2)
      'Republish Article — MiCA deep-dive',
      'Republish Article — EMI vs PI',
      // W3 (2)
      'Republish Article — Fintech M&A timeline',
      'Republish Article — Regulatory fines impact',
      // W4 (2)
      'Republish Article — Post-Brexit UK map',
      'Republish Article — Q2 2026 M&A recap',
      // W5 (1)
      'Republish Article — Case study highlights',
    ],
    extras: {
      targetSite: 'medium.com',
      anchorText: 'N5 Deal, fintech platform',
      destinationUrl: 'https://n5deal.com',
      dr: 94,
    },
  },
  {
    type: 'market_news',
    label: 'Market News post',
    weeklyCounts: [1, 1, 2, 1, 1],
    topics: [
      'MiCA July 1 deadline — CASP impact recap',
      'Live fintech M&A deal announcements (mid-week rephrase)',
      'MiCA enforcement first-month — early data',
      'EMI license transfer news — regulator update',
      'Cross-border deal announcements (EU/UK)',
      'Q2 2026 wrap — regulator commentary',
    ],
  },
  {
    type: 'profile',
    label: 'Profile placement',
    weeklyCounts: [2, 3, 3, 2, 0],
    topics: [
      'New DR-donor #1 (target TBD when picking)',
      'New DR-donor #2 (target TBD when picking)',
      'New DR-donor #3 (target TBD when picking)',
      'New DR-donor #4 (target TBD when picking)',
      'New DR-donor #5 (target TBD when picking)',
      'New DR-donor #6 (target TBD when picking)',
      'New DR-donor #7 (target TBD when picking)',
      'New DR-donor #8 (target TBD when picking)',
      'New DR-donor #9 (target TBD when picking)',
      'New DR-donor #10 (target TBD when picking)',
    ],
    extras: {
      anchorText: 'https://n5deal.com',
      destinationUrl: 'https://n5deal.com',
    },
  },
  {
    type: 'crowd',
    label: 'Reddit crowd post',
    weeklyCounts: [0, 3, 4, 4, 1],
    topics: [
      // W2 (3) — first posts with linking after W1 warmup
      'First post with linking (r/fintech) — post-warmup',
      'r/startups — related question with contextual link',
      'r/investing — regulatory topic answer',
      // W3 (4)
      'r/fintech — deal analysis answer',
      'r/Entrepreneur — licensing question',
      'r/CryptoCurrency — MiCA discussion',
      'r/fintech — M&A trend answer',
      // W4 (4)
      'r/investing — case study reference',
      'r/startups — compliance question',
      'r/fintech — regulator update',
      'r/investing — earn-out mechanics answer',
      // W5 (1)
      'r/fintech — Q2 2026 recap answer',
    ],
    extras: {
      targetSite: 'reddit.com',
      anchorText: 'https://n5deal.com',
      destinationUrl: 'https://n5deal.com',
      dr: 91,
    },
  },
  {
    type: 'outreach',
    label: 'Paid outreach',
    weeklyCounts: [0, 1, 1, 1, 0],
    topics: [
      'PRNews.io / Lucky Seven — renewal or new site',
      'PRNews.io alternative site (Lucky Seven panel)',
      'Test alternative outreach platform',
    ],
    extras: {
      targetSite: 'prnews.io',
      anchorText: 'https://n5deal.com',
      destinationUrl: 'https://n5deal.com',
      cost: 150,
    },
  },
]

// Spread N items evenly across a week — W1..W4 have 7 days, W5 has 3 (29,30,31).
// Returns the day-of-month (1..31) for a given item index inside a week.
function daysForWeek(week: 1 | 2 | 3 | 4 | 5, index: number, count: number): number {
  const size = week === 5 ? 3 : 7
  const startDay = (week - 1) * 7 + 1
  const offset = count === 1 ? 0 : Math.floor((index * (size - 1)) / (count - 1))
  return startDay + offset
}

type SeedRow = {
  title: string
  type: string
  scheduledFor: Date
  notes: string
  extras: TypeExtras
}

function build(): SeedRow[] {
  const rows: SeedRow[] = []
  for (const spec of SPECS) {
    let topicIndex = 0
    for (let w = 1; w <= 5; w++) {
      const count = spec.weeklyCounts[w - 1]
      for (let i = 0; i < count; i++) {
        const day = daysForWeek(w as 1 | 2 | 3 | 4 | 5, i, count)
        const dd = String(day).padStart(2, '0')
        const title = `${spec.label} — ${dd}.07`
        const topic = spec.topics?.[topicIndex] ?? ''
        const notes =
          `${SEED_MARKER}` +
          ` · W${w} · scheduled ${dd} Jul 2026` +
          (topic ? ` · Topic: ${topic}` : '')
        rows.push({
          title,
          type: spec.type,
          scheduledFor: new Date(Date.UTC(2026, 6, day, 9, 0, 0)),
          notes,
          extras: spec.extras ?? {},
        })
        topicIndex++
      }
    }
  }
  return rows
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id as string | undefined
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const project = await getOrCreateCurrentProject(userId)

  const { searchParams } = new URL(req.url)
  const force = searchParams.get('force') === 'true'

  // Idempotency guard: any prior seed rows (identified by the marker in notes)?
  const existing = await prisma.linkBuildingItem.count({
    where: {
      projectId: project.id,
      notes: { startsWith: SEED_MARKER },
    },
  })

  if (existing > 0 && !force) {
    return NextResponse.json(
      {
        error: 'Already seeded',
        existing,
        hint: 'Pass ?force=true to purge previous seed and re-seed. Manually-edited items (without the seed marker in notes) survive.',
      },
      { status: 409 },
    )
  }

  // Force mode: delete prior auto-seeded rows. Only touches rows the seeder
  // created; anything the operator added by hand stays.
  if (force && existing > 0) {
    await prisma.linkBuildingItem.deleteMany({
      where: {
        projectId: project.id,
        notes: { startsWith: SEED_MARKER },
      },
    })
  }

  const rows = build()
  const data = rows.map((r) => ({
    projectId: project.id,
    createdById: userId,
    title: r.title,
    type: r.type,
    status: 'planned',
    scheduledFor: r.scheduledFor,
    targetSite: r.extras.targetSite ?? null,
    anchorText: r.extras.anchorText ?? null,
    destinationUrl: r.extras.destinationUrl ?? null,
    dr: r.extras.dr ?? null,
    cost: r.extras.cost ?? null,
    notes: r.notes,
  }))

  const created = await prisma.linkBuildingItem.createMany({ data })

  // Bucket for the response — operator sees the 25/10/6/10/12/3 split at
  // a glance without switching tabs.
  const byType: Record<string, number> = {}
  for (const r of rows) byType[r.type] = (byType[r.type] ?? 0) + 1

  return NextResponse.json({
    ok: true,
    seeded: created.count,
    byType,
    marker: SEED_MARKER,
    boards: {
      tasks: (byType['article'] ?? 0) + (byType['medium'] ?? 0) + (byType['market_news'] ?? 0),
      linkbuilding: (byType['profile'] ?? 0) + (byType['crowd'] ?? 0) + (byType['outreach'] ?? 0),
    },
  })
}
