import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const BANKSTORE_ID = 'seed-project-bankstore'
const N5_ID = 'seed-project-n5deal'

async function main() {
  console.log('Seeding BankStore AI project (empty) + branding...')

  // Pick an owner: prefer an admin, otherwise the first user.
  const owner =
    (await prisma.user.findFirst({ where: { role: 'admin' }, orderBy: { createdAt: 'asc' } })) ??
    (await prisma.user.findFirst({ orderBy: { createdAt: 'asc' } }))
  if (!owner) throw new Error('No users found — create a user before seeding BankStore.')

  // Backfill N5Deal branding so both projects render a consistent badge/accent.
  await prisma.project.update({
    where: { id: N5_ID },
    data: { brandBadge: 'N5', brandColor: '222 47% 15%' },
  }).catch(() => console.warn('N5Deal project not found — skipping its branding backfill.'))

  // Create the empty BankStore AI project. No content is seeded — it starts blank.
  const bankstore = await prisma.project.upsert({
    where: { id: BANKSTORE_ID },
    update: { name: 'BankStore AI', companyName: 'BankStore', brandBadge: 'BS', brandColor: '168 76% 26%' },
    create: {
      id: BANKSTORE_ID,
      name: 'BankStore AI',
      companyName: 'BankStore',
      description: 'BankStore AI — adjacent project. Starts empty; fill in content, marketing and reports independently of N5Deal.',
      brandBadge: 'BS',
      brandColor: '168 76% 26%',
      ownerId: owner.id,
    },
  })

  // Add every existing user as a member so anyone logged in can switch into it.
  const users = await prisma.user.findMany({ select: { id: true } })
  for (const u of users) {
    await prisma.projectMember.upsert({
      where: { projectId_userId: { projectId: bankstore.id, userId: u.id } },
      update: {},
      create: {
        projectId: bankstore.id,
        userId: u.id,
        role: u.id === owner.id ? 'admin' : 'member',
      },
    })
  }

  console.log(`Done. BankStore AI = ${bankstore.id}, members = ${users.length}, owner = ${owner.id}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
