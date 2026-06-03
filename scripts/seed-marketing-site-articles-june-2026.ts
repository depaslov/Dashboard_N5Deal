// Mirrors the 18 "Site article" slots from the June 2026 link-building plan
// into the Marketing Calendar (SocialPost table) so the operator sees the
// same workload on both views.
//
// Idempotent on (yyyy-mm-dd, title) — safe to re-run. Titles match the LB
// seed format exactly ("Site article (n5deal.com) — DD.MM") so the two
// trackers cross-reference cleanly.
//
// Usage (local):
//   npx tsx --require dotenv/config scripts/seed-marketing-site-articles-june-2026.ts
// Against Neon:
//   DATABASE_URL="<neon>" npx tsx scripts/seed-marketing-site-articles-june-2026.ts

import { prisma } from '../lib/db'

const PROJECT_ID = process.env.PROJECT_ID || 'seed-project-n5deal'

// UTC noon so the date doesn't shift through any timezone in the UI.
const D = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d, 12, 0, 0))

// Same 18 dates as in scripts/seed-linkbuilding-june-2026.ts:
//   Mon Tue Wed Fri across w1-w4 (no Thu, Thu is WEB 2.0 day),
//   then the final two days of w5.
const ARTICLE_DATES: Date[] = [
  // Week 1
  D(2026, 6, 1),  D(2026, 6, 2),  D(2026, 6, 3),  D(2026, 6, 5),
  // Week 2
  D(2026, 6, 8),  D(2026, 6, 9),  D(2026, 6, 10), D(2026, 6, 12),
  // Week 3
  D(2026, 6, 15), D(2026, 6, 16), D(2026, 6, 17), D(2026, 6, 19),
  // Week 4
  D(2026, 6, 22), D(2026, 6, 23), D(2026, 6, 24), D(2026, 6, 26),
  // Week 5 (short week)
  D(2026, 6, 29), D(2026, 6, 30),
]

function titleFor(date: Date): string {
  const ddmm = date.toISOString().slice(0, 10).split('-').reverse().slice(0, 2).join('.')
  return `Site article (n5deal.com) — ${ddmm}`
}

async function main() {
  const project = await prisma.project.findUnique({ where: { id: PROJECT_ID } })
  if (!project) throw new Error(`Project ${PROJECT_ID} not found`)

  // Site articles belong to the n5 brand account.
  const n5 = await prisma.socialAccount.findFirst({
    where: { projectId: PROJECT_ID, slug: 'n5' },
  })
  if (!n5) throw new Error('N5Deal social account (slug=n5) not found')

  // De-dupe against the same (date, title) key the bulk-import API uses.
  const existing = await prisma.socialPost.findMany({
    where: {
      projectId: PROJECT_ID,
      scheduledFor: {
        gte: new Date(Date.UTC(2026, 5, 1)),
        lt: new Date(Date.UTC(2026, 6, 1)),
      },
    },
    select: { title: true, scheduledFor: true },
  })
  const seen = new Set(
    existing.map((p) => `${p.scheduledFor.toISOString().slice(0, 10)}|${p.title}`),
  )

  let inserted = 0
  let skipped = 0
  for (const date of ARTICLE_DATES) {
    const title = titleFor(date)
    const key = `${date.toISOString().slice(0, 10)}|${title}`
    if (seen.has(key)) { skipped++; continue }
    await prisma.socialPost.create({
      data: {
        projectId: PROJECT_ID,
        accountId: n5.id,
        type: 'Article',
        title,
        content: 'SEO / on-site article on n5deal.com — paired with the June link-building plan. Open the LinkBuilding tracker to see the matching slot. Topics rotate across the 6 core pages (EMI, PSP, buy / sell fintech, banking, crypto licenses).',
        platforms: ['Website'],
        scheduledFor: date,
        status: 'idea',
      },
    })
    inserted++
  }

  console.log(`\nJune 2026 site articles → Marketing Calendar:`)
  console.log(`  Total in plan:  ${ARTICLE_DATES.length}`)
  console.log(`  Inserted:       ${inserted}`)
  console.log(`  Skipped:        ${skipped} (already present)`)
  console.log('')
}

main()
  .catch((e) => { console.error('ERROR:', e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
