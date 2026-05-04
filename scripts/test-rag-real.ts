import { obsidianScope } from '../lib/obsidian-sync'
import { loadVectorStoreForScopes } from '../lib/embedding-store'
import { prisma } from '../lib/db'

const SCOPE = obsidianScope('seed-project-n5deal')

async function main() {
  const store = await loadVectorStoreForScopes([SCOPE])
  const queries = [
    'Як виглядає процес покупки ліцензії як buyer на n5deal?',
    'Які SEO ключові слова таргетити для fintech аудиторії?',
    'Що заборонено говорити юридично під час консультації?',
    'License prices for VASP and EMI',
    'How is the call structured for a fintech founder lead?',
    'Структура SMM-брифу для fintech builder',
    'хто в команді N5Deal відповідає за маркетинг',
  ]
  for (const q of queries) {
    console.log('\nQuery: ' + q)
    const r = await store.similaritySearchWithScore(q, 3)
    for (const [d, s] of r) {
      console.log(`  [${s.toFixed(3)}] ${d.metadata.key}`)
    }
  }
}
main().catch((e) => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
