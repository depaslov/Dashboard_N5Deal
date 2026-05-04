import { prisma } from '../lib/db'

async function main() {
  const counts = {
    ICP: await prisma.iCP.count(),
    Platform: await prisma.platform.count(),
    RedFlagWord: await prisma.redFlagWord.count(),
    Tag: await prisma.tag.count(),
    InternalLink: await prisma.internalLink.count(),
    PromptTemplate: await prisma.promptTemplate.count(),
    Project: await prisma.project.count(),
    User: await prisma.user.count(),
    GeneratedContent: await prisma.generatedContent.count(),
    EmbeddingChunk: await prisma.embeddingChunk.count(),
  }
  console.log('DB counts:')
  for (const [k, v] of Object.entries(counts)) {
    console.log('  ', k.padEnd(20), v)
  }
  await prisma.$disconnect()
}
main().catch((e) => { console.error('ERROR:', e.message); process.exit(1) })
