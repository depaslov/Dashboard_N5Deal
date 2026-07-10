import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getOrCreateCurrentProject } from '@/lib/project'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// ────────────────────────────────────────────────────────────────────────────
// Seed the July 2026 posting plan into LinkBuildingItem records so it shows
// up on /marketing/linkbuilding and /marketing/tasks. Idempotent — a
// signature notes-marker on every seeded row lets us detect prior seeds
// and either short-circuit (default) or optionally purge + reseed (?force).
//
// Split:
//   Tasks board (task-like types):
//     25 × 'article'      — Site articles for n5deal.com/blog
//      6 × 'market_news'  — Topical rephrase pieces
//   LinkBuilding board (real placement types):
//     10 × 'web20'        — Medium republications (WEB 2.0 backlinks)
//     10 × 'profile'      — Profile placements on DR-donors
//     12 × 'crowd'        — Reddit responses (after warmup)
//      3 × 'outreach'     — Paid outreach (PRNews.io etc.)
// Total: 66 items.
// ────────────────────────────────────────────────────────────────────────────

const SEED_MARKER = '[Auto-seeded: July 2026 plan]'

type SeedRow = { title: string; type: string; day: number; extra?: Partial<{
  targetSite: string
  anchorText: string
  destinationUrl: string
  dr: number
  cost: number
}> }

// Spread N titles across a week evenly, so days N=1..7 for a 7-day week or
// 1..3 for the short W5. week=1 → 1..7, week=2 → 8..14, ... week=5 → 29..31.
function daysForWeek(week: 1 | 2 | 3 | 4 | 5, index: number, count: number): number {
  const size = week === 5 ? 3 : 7
  const startDay = (week - 1) * 7 + 1
  // Even spread — first item on startDay, last item on startDay+size-1.
  const offset = count === 1 ? 0 : Math.floor((index * (size - 1)) / (count - 1))
  return startDay + offset
}

function build(): SeedRow[] {
  const rows: SeedRow[] = []

  // ── Articles: 25 (6+6+6+5+2 across W1-W5) ─────────────────────────────
  const articleTopics: string[] = [
    // W1 — continue Series 2 (licensing / regulatory)
    'Article #1 — Series 2: MiCA deep-dive (post-July-1 impact)',
    'Article #2 — Series 2: EMI vs PI — practical differences',
    'Article #3 — Series 2: Capital requirements by jurisdiction',
    'Article #4 — Series 2: Passporting after MiCA — what works',
    'Article #5 — Series 2: MSB Canada — underrated gateway',
    'Article #6 — Series 2: FCA vs CBI — updated for Q3 2026',
    // W2 — start Series 3 (case studies)
    'Article #7 — Series 3: Case study — Revolut licensing path',
    'Article #8 — Series 3: Case study — Wise cross-border deal',
    'Article #9 — Series 2: Fintech M&A timeline reality check',
    'Article #10 — Series 3: Case study — distressed EMI turnaround',
    'Article #11 — Series 2: How buyers value a licence',
    'Article #12 — Series 3: Case study — failed VASP transition',
    // W3
    'Article #13 — Series 2: Earn-outs in fintech M&A',
    'Article #14 — Series 3: Case study — bank licence acquisition',
    'Article #15 — Series 2: Regulatory fines and valuation impact',
    'Article #16 — Series 3: Case study — MiCA-driven consolidation',
    'Article #17 — Series 2: Information memorandum essentials',
    'Article #18 — Series 3: Case study — cross-border deal (EU-Gulf)',
    // W4
    'Article #19 — Series 2: Compliance function as an M&A asset',
    'Article #20 — Series 3: Case study — Netherlands DNB advantage',
    'Article #21 — Series 2: What kills fintech deals at LOI',
    'Article #22 — Series 3: Case study — Hong Kong stablecoin',
    'Article #23 — Series 2: Post-Brexit UK licensing map',
    // W5
    'Article #24 — Series 2: Q2 2026 fintech M&A recap (data)',
    'Article #25 — Series 3: Case study — successful earn-out close',
  ]
  const articleWeek = [1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 5, 5]
  const articleWeekCounts = [6, 6, 6, 5, 2]
  let articleWeekIndex = 0
  for (let i = 0; i < articleTopics.length; i++) {
    const w = articleWeek[i] as 1 | 2 | 3 | 4 | 5
    const weekIndex = articleWeekIndex
    const count = articleWeekCounts[w - 1]
    rows.push({
      title: articleTopics[i],
      type: 'article',
      day: daysForWeek(w, weekIndex, count),
    })
    articleWeekIndex = (weekIndex + 1) % count
    if (articleWeekIndex === 0 && i + 1 < articleTopics.length && articleWeek[i + 1] !== w) {
      articleWeekIndex = 0
    }
  }

  // ── Medium (WEB 2.0): 10 (3 carry-over W1 + 2/2/2/1 W2-W5) ───────────
  const mediumTitles = [
    // W1 — 3 carry-over from June's undelivered 3
    'Medium carry-over #1: Republish June text (WEB 2.0)',
    'Medium carry-over #2: Republish June text (WEB 2.0)',
    'Medium carry-over #3: Republish June text (WEB 2.0)',
    // W2-W5 — new Medium republications
    'Medium #4: Republish Article — MiCA deep-dive',
    'Medium #5: Republish Article — EMI vs PI',
    'Medium #6: Republish Article — Fintech M&A timeline',
    'Medium #7: Republish Article — Regulatory fines impact',
    'Medium #8: Republish Article — Post-Brexit UK map',
    'Medium #9: Republish Article — Q2 2026 M&A recap',
    'Medium #10: Republish Article — Case study collection',
  ]
  const mediumWeek = [1, 1, 1, 2, 2, 3, 3, 4, 4, 5]
  const mediumWeekCounts = [3, 2, 2, 2, 1]
  const mediumWeekIndex: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  for (let i = 0; i < mediumTitles.length; i++) {
    const w = mediumWeek[i] as 1 | 2 | 3 | 4 | 5
    const count = mediumWeekCounts[w - 1]
    rows.push({
      title: mediumTitles[i],
      type: 'web20',
      day: daysForWeek(w, mediumWeekIndex[w], count),
      extra: { targetSite: 'medium.com', anchorText: 'N5 Deal, fintech platform', destinationUrl: 'https://n5deal.com', dr: 94 },
    })
    mediumWeekIndex[w]++
  }

  // ── Market news: 6 (1/1/2/1/1 W1-W5) ──────────────────────────────────
  const marketNewsTopics = [
    'Market news W1: MiCA July 1 deadline — CASP impact recap',
    'Market news W2: Live fintech M&A deal announcements',
    'Market news W3: MiCA enforcement first month — early data',
    'Market news W3: EMI license transfer news (regulator update)',
    'Market news W4: Cross-border deal announcements (EU/UK)',
    'Market news W5: Q2 2026 wrap — regulator commentary',
  ]
  const marketNewsWeek = [1, 2, 3, 3, 4, 5]
  const marketNewsWeekCounts = [1, 1, 2, 1, 1]
  const marketNewsWeekIndex: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  for (let i = 0; i < marketNewsTopics.length; i++) {
    const w = marketNewsWeek[i] as 1 | 2 | 3 | 4 | 5
    const count = marketNewsWeekCounts[w - 1]
    rows.push({
      title: marketNewsTopics[i],
      type: 'market_news',
      day: daysForWeek(w, marketNewsWeekIndex[w], count),
    })
    marketNewsWeekIndex[w]++
  }

  // ── Profile backlinks: 10 (2/3/3/2/0 W1-W5) ─────────────────────────
  const profileTitles = [
    'Profile #1: New DR-donor placement (target TBD)',
    'Profile #2: New DR-donor placement (target TBD)',
    'Profile #3: New DR-donor placement (target TBD)',
    'Profile #4: New DR-donor placement (target TBD)',
    'Profile #5: New DR-donor placement (target TBD)',
    'Profile #6: New DR-donor placement (target TBD)',
    'Profile #7: New DR-donor placement (target TBD)',
    'Profile #8: New DR-donor placement (target TBD)',
    'Profile #9: New DR-donor placement (target TBD)',
    'Profile #10: New DR-donor placement (target TBD)',
  ]
  const profileWeek = [1, 1, 2, 2, 2, 3, 3, 3, 4, 4]
  const profileWeekCounts = [2, 3, 3, 2, 0]
  const profileWeekIndex: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  for (let i = 0; i < profileTitles.length; i++) {
    const w = profileWeek[i] as 1 | 2 | 3 | 4 | 5
    const count = profileWeekCounts[w - 1]
    rows.push({
      title: profileTitles[i],
      type: 'profile',
      day: daysForWeek(w, profileWeekIndex[w], count),
      extra: { anchorText: 'https://n5deal.com', destinationUrl: 'https://n5deal.com' },
    })
    profileWeekIndex[w]++
  }

  // ── Reddit (crowd): 12 (0/3/4/4/1 W1-W5 — W1 is warmup only) ────────
  const redditTitles = [
    'Reddit #1: First post with linking (after warmup)',
    'Reddit #2: r/fintech contextual answer',
    'Reddit #3: r/startups related question',
    'Reddit #4: r/investing regulatory topic',
    'Reddit #5: r/fintech deal analysis',
    'Reddit #6: r/entrepreneur licensing question',
    'Reddit #7: r/CryptoCurrency MiCA discussion',
    'Reddit #8: r/fintech M&A trend answer',
    'Reddit #9: r/investing case study reference',
    'Reddit #10: r/startups compliance question',
    'Reddit #11: r/fintech regulator update',
    'Reddit #12: r/investing Q2 recap',
  ]
  const redditWeek = [2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5]
  const redditWeekCounts = [0, 3, 4, 4, 1]
  const redditWeekIndex: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  for (let i = 0; i < redditTitles.length; i++) {
    const w = redditWeek[i] as 1 | 2 | 3 | 4 | 5
    const count = redditWeekCounts[w - 1]
    rows.push({
      title: redditTitles[i],
      type: 'crowd',
      day: daysForWeek(w, redditWeekIndex[w], count),
      extra: { targetSite: 'reddit.com', anchorText: 'https://n5deal.com', destinationUrl: 'https://n5deal.com', dr: 91 },
    })
    redditWeekIndex[w]++
  }

  // ── Paid outreach: 3 (0/1/1/1/0 W1-W5) ───────────────────────────────
  const outreachTitles = [
    'Paid outreach #1: PRNews.io / Lucky Seven (renewal or new site)',
    'Paid outreach #2: PRNews.io alternative site (Lucky Seven panel)',
    'Paid outreach #3: Test alternative outreach platform',
  ]
  const outreachWeek = [2, 3, 4]
  const outreachWeekCounts = [0, 1, 1, 1, 0]
  const outreachWeekIndex: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  for (let i = 0; i < outreachTitles.length; i++) {
    const w = outreachWeek[i] as 1 | 2 | 3 | 4 | 5
    const count = outreachWeekCounts[w - 1]
    rows.push({
      title: outreachTitles[i],
      type: 'outreach',
      day: daysForWeek(w, outreachWeekIndex[w], count),
      extra: { targetSite: 'prnews.io', anchorText: 'https://n5deal.com', destinationUrl: 'https://n5deal.com', cost: 150 },
    })
    outreachWeekIndex[w]++
  }

  return rows
}

function dayToDate(day: number): Date {
  // 9am UTC for a predictable time-of-day; matches bulk-import's convention.
  return new Date(Date.UTC(2026, 6, day, 9, 0, 0))
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id as string | undefined
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const project = await getOrCreateCurrentProject(userId)

  const { searchParams } = new URL(req.url)
  const force = searchParams.get('force') === 'true'

  // Idempotency: any existing rows with the seed marker in notes?
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
        hint: 'Pass ?force=true to purge previous seed and re-seed. Manually-edited items will be lost.',
      },
      { status: 409 },
    )
  }

  // Force mode: delete prior seed rows before re-seeding. Only touches rows
  // this seeder created (identified by the SEED_MARKER prefix); anything
  // the operator added by hand stays.
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
    scheduledFor: dayToDate(r.day),
    targetSite: r.extra?.targetSite ?? null,
    anchorText: r.extra?.anchorText ?? null,
    destinationUrl: r.extra?.destinationUrl ?? null,
    dr: r.extra?.dr ?? null,
    cost: r.extra?.cost ?? null,
    notes: `${SEED_MARKER} · type=${r.type} · scheduled ${r.day} Jul 2026`,
  }))

  const created = await prisma.linkBuildingItem.createMany({ data })

  // Bucket count by type for the response — operator sees at a glance that
  // the split matches the plan (25 articles / 10 medium / 6 mn / 10 profiles
  // / 12 crowd / 3 outreach).
  const byType: Record<string, number> = {}
  for (const r of rows) byType[r.type] = (byType[r.type] ?? 0) + 1

  return NextResponse.json({
    ok: true,
    seeded: created.count,
    byType,
    marker: SEED_MARKER,
  })
}
