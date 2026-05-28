// Read-only check of the latest GeneratedContent rows.
// Prints the most recent 10 articles from whatever DATABASE_URL is set to.
// Won't write or change anything.

import { prisma } from '../lib/db'

async function main() {
  const all = await prisma.generatedContent.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: {
      id: true,
      topic: true,
      contentType: true,
      createdAt: true,
      projectId: true,
      generatedBrief: true,
    },
  })

  if (all.length === 0) {
    console.log('No GeneratedContent rows in this database.')
    return
  }

  console.log(`Found ${all.length} most-recent rows in this DB:\n`)
  for (const g of all) {
    const bodyChars = (g.generatedBrief ?? '').length
    const created = g.createdAt.toISOString().replace('T', ' ').slice(0, 19)
    console.log(`  ${created}  [${g.contentType}]  ${g.topic.slice(0, 50).padEnd(50)}  ${bodyChars} chars  id=${g.id.slice(0, 8)}…`)
  }
  console.log()

  const total = await prisma.generatedContent.count()
  console.log(`Total GeneratedContent rows in this DB: ${total}`)
}

main()
  .catch((e) => { console.error('ERROR:', e.message); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
