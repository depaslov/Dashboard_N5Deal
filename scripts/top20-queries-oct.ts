import 'dotenv/config'
import { google } from 'googleapis'
import { getJwtClient } from '../lib/analytics/google-auth'

const SITE = 'sc-domain:n5deal.com'

async function main() {
  const auth = getJwtClient(['https://www.googleapis.com/auth/webmasters.readonly'])
  const sc = google.searchconsole({ version: 'v1', auth })

  const res = await sc.searchanalytics.query({
    siteUrl: SITE,
    requestBody: {
      startDate: '2026-10-01',
      endDate: '2026-10-30',
      dimensions: ['query'],
      rowLimit: 5000,
      dataState: 'final',
      type: 'web',
    },
  })

  const rows = (res.data.rows ?? []).map((r) => ({
    key: r.keys?.[0] ?? '',
    clicks: r.clicks ?? 0,
    impressions: r.impressions ?? 0,
    ctr: r.ctr ?? 0,
    position: r.position ?? 0,
  }))

  const top20 = rows
    .filter((r) => r.position <= 20 && r.position > 0)
    .sort((a, b) => b.impressions - a.impressions)

  console.log(`Total queries fetched: ${rows.length}`)
  console.log(`Queries with position <= 20: ${top20.length}`)
  console.log()
  console.log('='.repeat(100))
  console.log('All queries with position <= 20, sorted by impressions')
  console.log('='.repeat(100))
  for (const q of top20) {
    console.log(
      `${String(q.key).slice(0, 60).padEnd(60)} | imp=${String(q.impressions).padStart(5)} | clicks=${String(q.clicks).padStart(3)} | pos=${q.position.toFixed(1).padStart(5)} | ctr=${(q.ctr * 100).toFixed(2).padStart(6)}%`
    )
  }

  // save for report
  const fs = await import('fs')
  fs.writeFileSync('tmp/top20-queries-oct.json', JSON.stringify(top20, null, 2))
  console.log('\nSaved tmp/top20-queries-oct.json')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
