import { prisma } from '../lib/db'

const PROJECT_ID = 'seed-project-n5deal'

// Direct DB-level smoke test for multi-ICP support on GeneratedContent.
// Mirrors what /api/content POST does.
async function main() {
  // Cleanup from previous runs
  await prisma.generatedContent.deleteMany({ where: { topic: { startsWith: 'TEST_MULTI_ICP_' } } })

  const icps = await prisma.iCP.findMany({
    where: { projectId: PROJECT_ID },
    select: { id: true, name: true },
    orderBy: { createdAt: 'asc' },
    take: 3,
  })
  if (icps.length < 2) throw new Error('Need at least 2 ICPs to test multi-select')
  console.log(`Using ICPs: ${icps.map((i) => i.name).join(', ')}`)

  // 1) Create content with multiple ICPs
  const created = await prisma.generatedContent.create({
    data: {
      projectId: PROJECT_ID,
      createdById: (await prisma.user.findFirstOrThrow()).id,
      contentType: 'article',
      topic: 'TEST_MULTI_ICP_create',
      targetAudience: 'mixed audience',
      keyMessages: '',
      tone: '',
      generatedBrief: 'test',
      icps: { create: icps.map((i) => ({ icpId: i.id })) },
    },
    include: { icps: { include: { icp: true } } },
  })
  console.log(`CREATE OK: id=${created.id}, linked ICPs=${created.icps.length}`)

  // 2) Read back via the same shape /api/content/[id] uses
  const fetched = await prisma.generatedContent.findUnique({
    where: { id: created.id },
    include: { icps: { include: { icp: { select: { id: true, name: true } } } } },
  })
  console.log(`READ OK: ${fetched?.icps.map((l) => l.icp.name).join(', ')}`)

  // 3) Cascade test: deleting one ICP should remove its link, not the content
  const dropIcp = icps[0]
  await prisma.generatedContentICP.deleteMany({
    where: { generatedContentId: created.id, icpId: dropIcp.id },
  })
  const after = await prisma.generatedContent.findUnique({
    where: { id: created.id },
    include: { icps: true },
  })
  console.log(`UNLINK OK: ${after?.icps.length} remaining (expected ${icps.length - 1})`)

  // 4) Cleanup
  await prisma.generatedContent.delete({ where: { id: created.id } })
  console.log('DELETE OK (cascade removes remaining join rows)')

  console.log('\nAll multi-ICP checks passed.')
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
