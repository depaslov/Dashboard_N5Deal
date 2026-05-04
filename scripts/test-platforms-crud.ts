import { prisma } from '../lib/db'

const PROJECT_ID = 'seed-project-n5deal'

async function main() {
  await prisma.platform.deleteMany({ where: { projectId: PROJECT_ID, slug: { startsWith: 'test-' } } })

  // 1) CREATE
  const created = await prisma.platform.create({
    data: { projectId: PROJECT_ID, name: 'Test Platform', slug: 'test-create', formatType: 'post' },
  })
  console.log('CREATE OK:', created.id, created.slug)

  // 2) UNIQUE
  let dup: any = null
  try {
    await prisma.platform.create({
      data: { projectId: PROJECT_ID, name: 'Dup', slug: 'test-create', formatType: 'post' },
    })
  } catch (e: any) { dup = e?.code }
  console.log('UNIQUE OK (P2002 expected):', dup)

  // 3) UPDATE
  const updated = await prisma.platform.update({
    where: { id: created.id },
    data: { tone: 'Test tone', maxLength: 300, lengthUnit: 'chars' },
  })
  console.log('UPDATE OK:', updated.tone, updated.maxLength, updated.lengthUnit)

  // 4) GET filter active
  const active = await prisma.platform.findMany({
    where: { projectId: PROJECT_ID, isActive: true },
  })
  const inactive = await prisma.platform.findMany({
    where: { projectId: PROJECT_ID, isActive: false },
  })
  console.log(`GET filter OK: ${active.length} active, ${inactive.length} inactive`)

  // 5) DELETE
  await prisma.platform.delete({ where: { id: created.id } })
  const after = await prisma.platform.findUnique({ where: { id: created.id } })
  console.log('DELETE OK:', after === null)

  console.log('\nAll Platform CRUD checks passed.')
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
