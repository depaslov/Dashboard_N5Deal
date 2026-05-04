import { prisma } from '../lib/db'

async function main() {
  const projects = await prisma.project.findMany({ select: { id: true, name: true, ownerId: true, createdAt: true } })
  console.log('Projects:')
  for (const p of projects) {
    const icps = await prisma.iCP.count({ where: { projectId: p.id } })
    const platforms = await prisma.platform.count({ where: { projectId: p.id } })
    const tags = await prisma.tag.count({ where: { projectId: p.id } })
    const flags = await prisma.redFlagWord.count({ where: { projectId: p.id } })
    const links = await prisma.internalLink.count({ where: { projectId: p.id } })
    console.log(`  ${p.id} — "${p.name}"`)
    console.log(`     owner: ${p.ownerId}, created: ${p.createdAt.toISOString()}`)
    console.log(`     ICP: ${icps}, Platform: ${platforms}, Tag: ${tags}, RedFlag: ${flags}, InternalLink: ${links}`)
  }

  const users = await prisma.user.findMany({ select: { id: true, email: true, name: true, role: true } })
  console.log('\nUsers:')
  users.forEach(u => console.log(`  ${u.email.padEnd(30)} role: ${u.role}, id: ${u.id}`))

  await prisma.$disconnect()
}
main().catch((e) => { console.error('ERROR:', e.message); process.exit(1) })
