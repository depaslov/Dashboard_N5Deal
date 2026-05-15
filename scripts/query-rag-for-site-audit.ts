// Pull from the RAG (EmbeddingChunk) the chunks most relevant to a site audit:
// brand positioning, ICPs, SEO clusters, tone of voice, compliance stance.
import { prisma } from '../lib/db'

const QUERIES = [
  { label: 'BRAND POSITIONING / FINTECH BUILDER', terms: ['fintech builder', 'positioning', 'brand', 'identity', 'introducer', 'marketplace introducer'] },
  { label: 'ICP / TARGET AUDIENCE', terms: ['ICP', 'persona', 'target audience', 'fintech founder', 'buyer profile', 'seller profile'] },
  { label: 'TONE / VOICE / HOUSE STYLE', terms: ['tone of voice', 'house style', 'STYLE_GUIDE', 'brand voice', 'platform identity'] },
  { label: 'SEO CLUSTERS / CONTENT STRATEGY', terms: ['SEO cluster', 'content cluster', 'pillar', 'content strategy', 'taxonomy'] },
  { label: 'COMPLIANCE / REGULATORY', terms: ['FCA', 'MiFID', 'regulated activity', 'introducer', 'not licensed', 'compliance'] },
  { label: 'SITE / HOMEPAGE COPY', terms: ['homepage', 'hero', 'landing', 'value proposition', 'buy or sell'] },
  { label: 'CTA / CONVERSION', terms: ['call to action', 'CTA', 'conversion', 'lead magnet', 'free valuation'] },
  { label: 'COMPETITORS / BENCHMARKS', terms: ['competitor', 'benchmark', 'similar platform', 'market gap'] },
]

async function main() {
  for (const q of QUERIES) {
    console.log('\n========================================================================')
    console.log(`### ${q.label}`)
    console.log('========================================================================')
    const where = {
      AND: [
        { scope: { contains: 'project:seed-project-n5deal' } },
        { OR: q.terms.map((t) => ({ content: { contains: t, mode: 'insensitive' as const } })) },
      ],
    }
    const rows = await prisma.embeddingChunk.findMany({
      where,
      select: { key: true, content: true, metadata: true },
      take: 4,
    })
    if (!rows.length) {
      console.log('  (no relevant chunks found)')
      continue
    }
    for (const r of rows) {
      console.log(`\n— ${r.key}`)
      console.log(r.content.slice(0, 600).trim().replace(/\n+/g, ' '))
      if (r.content.length > 600) console.log(`  …[+${r.content.length - 600} chars]`)
    }
  }
  await prisma.$disconnect()
}
main().catch((e) => { console.error('ERROR:', e.message); process.exit(1) })
