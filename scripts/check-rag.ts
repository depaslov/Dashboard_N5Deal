import { prisma } from '../lib/db'

async function main() {
  const total = await prisma.embeddingChunk.count()
  console.log('Total embedding chunks:', total)

  if (total > 0) {
    const byScope: Array<{ scope: string; count: number; keys: number }> =
      await prisma.$queryRaw`SELECT scope, COUNT(*)::int as count, COUNT(DISTINCT key)::int as keys FROM "EmbeddingChunk" GROUP BY scope ORDER BY count DESC`
    console.log('\nBy scope:')
    byScope.forEach((r) =>
      console.log(' -', r.scope.padEnd(40), 'chunks:', String(r.count).padStart(5), '| keys:', r.keys),
    )

    const sample = await prisma.embeddingChunk.findFirst({
      select: { scope: true, key: true, content: true, createdAt: true, metadata: true },
    })
    console.log('\nSample chunk:')
    console.log(' scope:', sample?.scope)
    console.log(' key:', sample?.key)
    console.log(' createdAt:', sample?.createdAt)
    console.log(' metadata:', JSON.stringify(sample?.metadata))
    console.log(' content preview:', sample?.content?.slice(0, 200) + '...')

    const oldest = await prisma.embeddingChunk.findFirst({ orderBy: { createdAt: 'asc' }, select: { createdAt: true } })
    const newest = await prisma.embeddingChunk.findFirst({ orderBy: { createdAt: 'desc' }, select: { createdAt: true } })
    console.log('\nDate range:')
    console.log(' oldest:', oldest?.createdAt)
    console.log(' newest:', newest?.createdAt)
  }

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error('ERROR:', e.message)
  process.exit(1)
})
