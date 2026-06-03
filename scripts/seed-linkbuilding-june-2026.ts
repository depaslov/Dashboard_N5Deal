// Seeds the LinkBuildingItem table with the operator's June 2026 daily plan.
//
// Monthly targets: 7 Profiles · 7 WEB 2.0 · 7 Crowd · 8 Medium · ~15 Market News
// · 15–20 Articles · 2 Outreach (link insert / guest). 67 items total scheduled.
//
// Idempotent on (yyyy-mm-dd, title).
//
// Usage:
//   npx tsx --require dotenv/config scripts/seed-linkbuilding-june-2026.ts
// Against Neon:
//   DATABASE_URL="<neon>" npx tsx scripts/seed-linkbuilding-june-2026.ts

import { prisma } from '../lib/db'

const PROJECT_ID = process.env.PROJECT_ID || 'seed-project-n5deal'

const D = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d, 9, 0, 0))

type Type =
  | 'profile' | 'web20' | 'crowd' | 'medium' | 'article'
  | 'market_news' | 'outreach'

interface Slot { type: Type; date: Date; suffix?: string; notes?: string }

// Build the schedule day-by-day so the source matches the operator's plan
// verbatim. Easy to diff / re-edit when the plan changes month over month.
const PLAN: Slot[] = [
  // Week 1 ──────────────────────────────────────────────────────────────
  { type:'profile',     date: D(2026,6,1) },
  { type:'web20',       date: D(2026,6,1) },
  { type:'crowd',       date: D(2026,6,1) },
  { type:'medium',      date: D(2026,6,1) },
  { type:'article',     date: D(2026,6,1) },
  { type:'market_news', date: D(2026,6,1) },

  { type:'article',     date: D(2026,6,2) },
  { type:'market_news', date: D(2026,6,2) },

  { type:'profile',     date: D(2026,6,3) },
  { type:'crowd',       date: D(2026,6,3) },
  { type:'article',     date: D(2026,6,3) },

  { type:'web20',       date: D(2026,6,4) },
  { type:'market_news', date: D(2026,6,4) },

  { type:'article',     date: D(2026,6,5) },
  { type:'market_news', date: D(2026,6,5) },

  // Week 2 ──────────────────────────────────────────────────────────────
  { type:'profile',     date: D(2026,6,8) },
  { type:'web20',       date: D(2026,6,8) },
  { type:'crowd',       date: D(2026,6,8) },
  { type:'medium',      date: D(2026,6,8) },
  { type:'article',     date: D(2026,6,8) },
  { type:'market_news', date: D(2026,6,8) },

  { type:'article',     date: D(2026,6,9) },

  { type:'profile',     date: D(2026,6,10) },
  { type:'crowd',       date: D(2026,6,10) },
  { type:'article',     date: D(2026,6,10) },
  { type:'market_news', date: D(2026,6,10) },

  { type:'web20',       date: D(2026,6,11) },
  { type:'market_news', date: D(2026,6,11) },

  { type:'medium',      date: D(2026,6,12) },
  { type:'article',     date: D(2026,6,12) },

  // Week 3 ──────────────────────────────────────────────────────────────
  { type:'profile',     date: D(2026,6,15) },
  { type:'web20',       date: D(2026,6,15) },
  { type:'crowd',       date: D(2026,6,15) },
  { type:'medium',      date: D(2026,6,15) },
  { type:'article',     date: D(2026,6,15) },
  { type:'market_news', date: D(2026,6,15) },

  { type:'article',     date: D(2026,6,16) },
  { type:'market_news', date: D(2026,6,16) },

  { type:'profile',     date: D(2026,6,17) },
  { type:'crowd',       date: D(2026,6,17), suffix:'Reddit start', notes:'Kickoff of the Reddit crowd-marketing arc — pick 2–3 active subs to seed.' },
  { type:'article',     date: D(2026,6,17) },

  { type:'web20',       date: D(2026,6,18) },
  { type:'market_news', date: D(2026,6,18) },
  { type:'outreach',    date: D(2026,6,18), suffix:'link insert / guest', notes:'Pitch one link insert or one guest-post slot to a vetted donor.' },

  { type:'medium',      date: D(2026,6,19) },
  { type:'article',     date: D(2026,6,19) },

  // Week 4 ──────────────────────────────────────────────────────────────
  { type:'profile',     date: D(2026,6,22) },
  { type:'web20',       date: D(2026,6,22) },
  { type:'crowd',       date: D(2026,6,22) },
  { type:'medium',      date: D(2026,6,22) },
  { type:'article',     date: D(2026,6,22) },
  { type:'market_news', date: D(2026,6,22) },

  { type:'article',     date: D(2026,6,23) },
  { type:'market_news', date: D(2026,6,23) },

  { type:'crowd',       date: D(2026,6,24) },
  { type:'article',     date: D(2026,6,24) },

  { type:'web20',       date: D(2026,6,25) },
  { type:'market_news', date: D(2026,6,25) },
  { type:'outreach',    date: D(2026,6,25), suffix:'link insert / guest', notes:'Second outreach push of the month.' },

  { type:'medium',      date: D(2026,6,26) },
  { type:'article',     date: D(2026,6,26) },

  // Week 5 ──────────────────────────────────────────────────────────────
  { type:'crowd',       date: D(2026,6,29) },
  { type:'medium',      date: D(2026,6,29) },
  { type:'article',     date: D(2026,6,29) },
  { type:'market_news', date: D(2026,6,29), suffix:'+ report collection', notes:'Start the monthly report — pull GA + Search Console + LB metrics.' },

  { type:'article',     date: D(2026,6,30) },
  { type:'market_news', date: D(2026,6,30), suffix:'+ finalisation', notes:'Final pass + publish the June LB summary.' },
]

const LABELS: Record<Type, string> = {
  profile:     'Profile link',
  web20:       'Web 2.0 post',
  crowd:       'Crowd marketing post',
  medium:      'Medium article',
  article:     'Site article (n5deal.com)',
  market_news: 'Market News post',
  outreach:    'Outreach',
}

function titleFor(s: Slot): string {
  const dateStr = s.date.toISOString().slice(0, 10).split('-').reverse().slice(0, 2).join('.')
  return `${LABELS[s.type]} — ${dateStr}${s.suffix ? ` · ${s.suffix}` : ''}`
}

async function main() {
  const project = await prisma.project.findUnique({ where: { id: PROJECT_ID } })
  if (!project) throw new Error(`Project ${PROJECT_ID} not found`)

  const existing = await prisma.linkBuildingItem.findMany({
    where: {
      projectId: PROJECT_ID,
      scheduledFor: {
        gte: new Date(Date.UTC(2026, 5, 1)),
        lt: new Date(Date.UTC(2026, 6, 1)),
      },
    },
    select: { title: true, scheduledFor: true },
  })
  const seen = new Set(existing.map((e) => `${e.scheduledFor.toISOString().slice(0, 10)}|${e.title}`))

  const byType: Record<string, number> = {}
  let inserted = 0
  let skipped = 0
  for (const s of PLAN) {
    const title = titleFor(s)
    const key = `${s.date.toISOString().slice(0, 10)}|${title}`
    if (seen.has(key)) { skipped++; continue }
    await prisma.linkBuildingItem.create({
      data: {
        projectId: PROJECT_ID,
        title,
        type: s.type,
        status: 'planned',
        scheduledFor: s.date,
        notes: s.notes ?? null,
      },
    })
    inserted++
    byType[s.type] = (byType[s.type] ?? 0) + 1
    seen.add(key)
  }

  console.log(`\nJune 2026 link-building plan:`)
  console.log(`  Total slots in plan: ${PLAN.length}`)
  console.log(`  Inserted now:        ${inserted}`)
  console.log(`  Skipped (already):   ${skipped}`)
  if (inserted > 0) {
    console.log(`\n  Breakdown by type:`)
    for (const [t, n] of Object.entries(byType).sort((a, b) => b[1] - a[1])) {
      console.log(`    ${t.padEnd(14)} ${n}`)
    }
  }
  console.log('')
}

main()
  .catch((e) => { console.error('ERROR:', e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
