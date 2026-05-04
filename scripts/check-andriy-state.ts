import { PrismaClient } from '@prisma/client'

const NEON_URL = process.env.NEON_DB_URL
if (!NEON_URL) { console.error('Set NEON_DB_URL'); process.exit(1) }
const prisma = new PrismaClient({ datasources: { db: { url: NEON_URL } } })

async function main() {
  const u = await prisma.user.findUnique({ where: { email: 'andriy.krechkivsky@gmail.com' } })
  if (!u) { console.log('User not found'); return }
  console.log('User:', u.email, 'id:', u.id, 'role:', u.role)

  const memberships = await prisma.projectMember.findMany({
    where: { userId: u.id },
    include: { project: true },
    orderBy: { createdAt: 'asc' },
  })
  console.log(`\nMemberships (${memberships.length}):`)
  memberships.forEach((m) => {
    console.log(`  - project: ${m.project.id} "${m.project.name}"`)
    console.log(`    role: ${m.role}, member-since: ${m.createdAt.toISOString()}`)
  })

  const owned = await prisma.project.findMany({ where: { ownerId: u.id } })
  console.log(`\nOwned projects (${owned.length}):`)
  owned.forEach((p) => console.log(`  - ${p.id} "${p.name}"`))

  if (memberships.length > 0) {
    const first = memberships[0].project
    console.log(`\n→ getOrCreateCurrentProject would return: "${first.name}" (${first.id})`)
    const icps = await prisma.iCP.count({ where: { projectId: first.id } })
    const platforms = await prisma.platform.count({ where: { projectId: first.id } })
    const tags = await prisma.tag.count({ where: { projectId: first.id } })
    const flags = await prisma.redFlagWord.count({ where: { projectId: first.id } })
    console.log(`  ICP=${icps}, Platform=${platforms}, Tag=${tags}, RedFlag=${flags}`)
  }

  await prisma.$disconnect()
}
main().catch((e) => { console.error('ERROR:', e.message); process.exit(1) })
