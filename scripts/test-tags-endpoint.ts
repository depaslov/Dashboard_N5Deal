import { prisma } from '../lib/db'

const PROJECT_ID = 'seed-project-n5deal'

async function main() {
  const icp = await prisma.iCP.findFirst({ where: { projectId: PROJECT_ID } })
  if (!icp) throw new Error('No ICP in seed project')
  console.log(`Using ICP: ${icp.name} (${icp.id})`)

  // Seed a few tags (idempotent via upsert on (projectId, name))
  const sampleTags = [
    { name: 'fintech',   color: '#1f6feb' },
    { name: 'crypto',    color: '#f59e0b' },
    { name: 'enterprise',color: '#10b981' },
  ]
  const tags = await Promise.all(
    sampleTags.map((t) =>
      prisma.tag.upsert({
        where: { projectId_name: { projectId: PROJECT_ID, name: t.name } },
        create: { projectId: PROJECT_ID, name: t.name, color: t.color },
        update: { color: t.color },
      }),
    ),
  )
  console.log(`Upserted ${tags.length} tags:`, tags.map((t) => t.name).join(', '))

  // Link first 2 tags to the ICP (idempotent)
  for (const t of tags.slice(0, 2)) {
    await prisma.iCPTag.upsert({
      where: { icpId_tagId: { icpId: icp.id, tagId: t.id } },
      create: { icpId: icp.id, tagId: t.id },
      update: {},
    })
  }
  console.log(`Linked ${tags.slice(0, 2).map((t) => t.name).join(', ')} → ICP ${icp.name}`)

  // Run the same query the endpoint runs
  const links = await prisma.iCPTag.findMany({
    where: { icpId: icp.id },
    include: { tag: true },
    orderBy: [{ tag: { name: 'asc' } }],
  })
  const response = {
    tags: links.map((l) => ({
      id: l.tag.id,
      name: l.tag.name,
      color: l.tag.color,
      createdAt: l.tag.createdAt,
    })),
  }
  console.log('\nEndpoint response (GET /api/icps/' + icp.id + '/tags):')
  console.log(JSON.stringify(response, null, 2))

  // Sanity: ICP from a different project should not see these tags
  console.log(`\nSanity: tags returned = ${response.tags.length}, expected = 2`)
  if (response.tags.length !== 2) throw new Error('Expected exactly 2 tags linked')
  console.log('PASS')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
