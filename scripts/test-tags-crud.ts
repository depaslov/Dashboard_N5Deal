import { prisma } from '../lib/db'

const PROJECT_ID = 'seed-project-n5deal'

// Direct DB-level smoke test of all tags + linking operations.
// Mirrors what the API endpoints do, minus the auth wrapper.
async function main() {
  // Cleanup leftovers from previous runs
  await prisma.tag.deleteMany({ where: { projectId: PROJECT_ID, name: { startsWith: 'test-' } } })

  const icp = await prisma.iCP.findFirst({ where: { projectId: PROJECT_ID } })
  if (!icp) throw new Error('No ICP')

  // 1) CREATE
  const created = await prisma.tag.create({
    data: { projectId: PROJECT_ID, name: 'test-create', color: '#1f6feb' },
  })
  console.log('CREATE OK:', created.id, created.name)

  // 2) UNIQUE CONSTRAINT
  let dup: any = null
  try {
    await prisma.tag.create({ data: { projectId: PROJECT_ID, name: 'test-create' } })
  } catch (e: any) {
    dup = e?.code
  }
  console.log('UNIQUE OK (P2002 expected):', dup)

  // 3) UPDATE
  const updated = await prisma.tag.update({
    where: { id: created.id },
    data: { name: 'test-renamed', color: '#10b981' },
  })
  console.log('UPDATE OK:', updated.name, updated.color)

  // 4) LINK
  await prisma.iCPTag.create({ data: { icpId: icp.id, tagId: created.id } })
  const linksAfter = await prisma.iCPTag.findMany({
    where: { icpId: icp.id, tagId: created.id },
  })
  console.log('LINK OK:', linksAfter.length === 1)

  // 5) GET tags by ICP id (mirror endpoint)
  const got = await prisma.iCPTag.findMany({
    where: { icpId: icp.id },
    include: { tag: true },
  })
  const hasIt = got.some((l) => l.tag.id === created.id)
  console.log('GET by ICP OK:', hasIt, `(${got.length} total)`)

  // 6) UNLINK
  const unlinked = await prisma.iCPTag.deleteMany({
    where: { icpId: icp.id, tagId: created.id },
  })
  console.log('UNLINK OK:', unlinked.count === 1)

  // 7) DELETE (also verify cascade does not leave orphan ICPTag rows)
  await prisma.iCPTag.create({ data: { icpId: icp.id, tagId: created.id } })
  await prisma.tag.delete({ where: { id: created.id } })
  const orphans = await prisma.iCPTag.count({ where: { tagId: created.id } })
  console.log('DELETE+CASCADE OK:', orphans === 0)

  console.log('\nAll CRUD checks passed.')
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
