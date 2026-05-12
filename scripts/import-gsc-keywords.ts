// One-shot script — import the GSC export the user shared into SeoKeyword.
// Format per row: "keyword, clicks, impressions" (positions unknown).
// Idempotent — re-running upserts existing rows in place.
//
// Usage:
//   npx tsx --require dotenv/config scripts/import-gsc-keywords.ts        # local
//   DATABASE_URL="<neon>" npx tsx --require dotenv/config scripts/import-gsc-keywords.ts

import { prisma } from '../lib/db'

const PROJECT_ID = 'seed-project-n5deal'

const RAW: { keyword: string; clicks: number; impressions: number }[] = [
  { keyword: 'n5deal', clicks: 85, impressions: 126 },
  { keyword: 'n5bank', clicks: 1, impressions: 39 },
  { keyword: 'n5 bank', clicks: 0, impressions: 49 },
  { keyword: 'n5 now', clicks: 0, impressions: 23 },
  { keyword: 'n5', clicks: 0, impressions: 17 },
  { keyword: 'sell home n5', clicks: 0, impressions: 12 },
  { keyword: 'n5.com', clicks: 0, impressions: 9 },
  { keyword: 'n deal', clicks: 0, impressions: 9 },
  { keyword: 'n5 fintech', clicks: 0, impressions: 7 },
  { keyword: 'n5 now official website', clicks: 0, impressions: 4 },
  { keyword: 'n5 ltd', clicks: 0, impressions: 4 },
  { keyword: '5 deal', clicks: 0, impressions: 3 },
  { keyword: 'n 5', clicks: 0, impressions: 3 },
  { keyword: 'deal5', clicks: 0, impressions: 2 },
  { keyword: 'n5 llc', clicks: 0, impressions: 2 },
  { keyword: 'deal fintech', clicks: 0, impressions: 2 },
  { keyword: 'deal n', clicks: 0, impressions: 2 },
  { keyword: 'n-5', clicks: 0, impressions: 2 },
  { keyword: 'n deals', clicks: 0, impressions: 1 },
  { keyword: 'n5d', clicks: 0, impressions: 1 },
  { keyword: 'm&a marketplace platform buyers sellers companies europe financial services', clicks: 0, impressions: 1 },
  { keyword: 'n5 company', clicks: 0, impressions: 1 },
  { keyword: 'nu deal', clicks: 0, impressions: 1 },
  { keyword: '15dealx', clicks: 0, impressions: 1 },
  { keyword: 'deal 5', clicks: 0, impressions: 1 },
  { keyword: 'psp license in estonia for sale', clicks: 0, impressions: 1 },
]

// Classify each keyword: brand vs topic-cluster commercial.
function classify(keyword: string): { intent: string; cluster: string } {
  const k = keyword.toLowerCase()
  if (/(psp|emi|msb|vasp|banking|crypto|m&a|marketplace|license|fintech\b)/.test(k)) {
    // Topic-cluster commercial intent — pick the cluster
    if (/psp/.test(k)) return { intent: 'commercial', cluster: 'PSP' }
    if (/emi/.test(k)) return { intent: 'commercial', cluster: 'EMI' }
    if (/msb/.test(k)) return { intent: 'commercial', cluster: 'MSB' }
    if (/vasp/.test(k)) return { intent: 'commercial', cluster: 'VASP' }
    if (/m&a|marketplace/.test(k)) return { intent: 'commercial', cluster: 'M&A' }
    if (/crypto/.test(k)) return { intent: 'commercial', cluster: 'Crypto' }
    if (/banking/.test(k)) return { intent: 'commercial', cluster: 'Banking' }
    return { intent: 'commercial', cluster: 'Fintech' }
  }
  // Everything else is a brand/navigational query
  return { intent: 'navigational', cluster: 'Brand' }
}

async function main() {
  console.log(`Importing ${RAW.length} GSC keywords into project ${PROJECT_ID}...`)

  let created = 0
  let updated = 0
  for (const row of RAW) {
    const { intent, cluster } = classify(row.keyword)
    const existing = await prisma.seoKeyword.findUnique({
      where: { projectId_keyword: { projectId: PROJECT_ID, keyword: row.keyword } },
    })

    const data = {
      clicks: row.clicks,
      impressions: row.impressions,
      cluster,
      intent,
      locale: 'global',
      isActive: true,
      notes: 'Imported from Google Search Console export',
    }

    await prisma.seoKeyword.upsert({
      where: { projectId_keyword: { projectId: PROJECT_ID, keyword: row.keyword } },
      create: {
        projectId: PROJECT_ID,
        keyword: row.keyword,
        ...data,
      },
      update: data,
    })
    if (existing) updated++; else created++
  }

  console.log(`Done — created: ${created}, updated: ${updated}`)

  // Quick summary
  const total = await prisma.seoKeyword.count({ where: { projectId: PROJECT_ID } })
  const brand = await prisma.seoKeyword.count({ where: { projectId: PROJECT_ID, cluster: 'Brand' } })
  const commercial = await prisma.seoKeyword.count({ where: { projectId: PROJECT_ID, intent: 'commercial' } })
  console.log(`\nProject ${PROJECT_ID}:`)
  console.log(`  Total SEO keywords: ${total}`)
  console.log(`  Brand (navigational): ${brand}`)
  console.log(`  Commercial intent: ${commercial}`)
}

main()
  .catch((e) => { console.error('ERROR:', e?.message ?? e); process.exit(1) })
  .finally(() => prisma.$disconnect())
