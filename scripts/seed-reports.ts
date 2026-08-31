import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'

const prisma = new PrismaClient()

const N5_ID = 'seed-project-n5deal'
const SEED_DIR = path.resolve(process.cwd(), 'scripts/report-seeds')

// Seeds the canonical operational reports (content authored in the repo as the
// HTML files under scripts/report-seeds/). These are SYNCED from the repo: every
// run re-writes their content from the seed files, so editing a report's source
// here + deploying updates it in place (local and prod). Only the slugs listed
// below are touched — reports created by the user via the dashboard's "New
// report" button are NOT in this list and are never modified.
// (If a canonical report should become hand-editable in the dashboard instead,
// drop its entry from this array.)
const REPORTS: Array<{
  slug: string
  title: string
  periodLabel: string
  subtitle: string
  kind: 'recap' | 'plan'
  sortKey: string
}> = [
  {
    slug: '2026-08-social',
    title: 'N5Deal — Social & Search Performance, August 2026',
    periodLabel: 'Серпень 2026',
    subtitle:
      'Соцмережі + SEO, серпень (baseline). Охоплення 291 369 показів (95% — фаундери, 81% — три пости). SEO: DR 13 (+2), беклінки 923 (+336), 13 органічних ключів (4 у топ-3), GA4 organic 162 кліки / 76k показів, AI-видимість 11 (AI Mode, Perplexity, AI Overviews). Founder-cards, top-контент, висновки й рішення.',
    kind: 'recap',
    sortKey: '2026-08-1',
  },
  {
    slug: '2026-09-plan',
    title: 'N5Deal — September 2026 Content and Task Plan',
    periodLabel: 'Вересень 2026 (план)',
    subtitle:
      '31 матеріал / 38 розміщень за 5 тижнів. 4 core messages (M1–M4), календар по каналах (LinkedIn / IG / X / Newsletter / Listings), OKR-покриття, залежності з дедлайнами, жовтень — San Francisco, вимірювання та ризики.',
    kind: 'plan',
    sortKey: '2026-09-1',
  },
  {
    slug: '2026-07',
    title: 'N5Deal — Загальний звіт за липень 2026',
    periodLabel: 'Липень 2026',
    subtitle:
      'Повний звіт: SEO / лінкбілдинг (DR 6→11, +201 беклінк), органіка вперше (65 візитів), AI-видимість, LinkedIn 3 фаундерів (245K показів, 338 переходів), X / Threads, воронка GA4 (449 чистих сесій, key events = 0), 6 лідів, обмеження даних і фокус на серпень.',
    kind: 'recap',
    sortKey: '2026-07-2',
  },
  {
    slug: '2026-07-plan',
    title: 'N5Deal — План на липень 2026',
    periodLabel: 'Липень 2026 (план)',
    subtitle:
      '66 матеріалів по каналах: 25 articles + 10 Medium (3 carry-over) + 6 market news + 10 profiles + 12 Reddit + 3 paid outreach. Тижнева розбивка + денний ритм W1-W2.',
    kind: 'plan',
    sortKey: '2026-07-1',
  },
  {
    slug: '2026-06',
    title: 'N5Deal — Звіт за червень 2026',
    periodLabel: 'Червень 2026',
    subtitle:
      '13 статей у блог (fintech licensing / M&A advisory / regulatory) + 6 Medium (WEB 2.0). Секція GA4-аналітики. Press Releases + Glossary + Deployment infra на дешборді. LB: 7 профілів, 7 Reddit (забанили), 6 Medium, перша закупка PRNews.io.',
    kind: 'recap',
    sortKey: '2026-06-0',
  },
]

async function main() {
  const project = await prisma.project.findUnique({ where: { id: N5_ID } })
  if (!project) {
    console.warn(`Project ${N5_ID} not found — skipping report seed.`)
    return
  }

  for (const r of REPORTS) {
    const file = path.join(SEED_DIR, `${r.slug}.html`)
    if (!fs.existsSync(file)) {
      console.warn(`Seed HTML missing for ${r.slug} (${file}) — skipping.`)
      continue
    }
    const bodyHtml = fs.readFileSync(file, 'utf8')
    const fields = {
      title: r.title,
      periodLabel: r.periodLabel,
      subtitle: r.subtitle,
      kind: r.kind,
      sortKey: r.sortKey,
      bodyHtml,
    }
    await prisma.operationalReport.upsert({
      where: { projectId_slug: { projectId: N5_ID, slug: r.slug } },
      update: fields, // sync content from the repo on every run
      create: { projectId: N5_ID, slug: r.slug, ...fields },
    })
    console.log(`seeded ${r.slug} (${bodyHtml.length} bytes)`)
  }
  console.log('Done seeding operational reports.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
