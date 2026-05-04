// Move every Neon user into the shared seed-project-n5deal workspace and
// delete their personal auto-created workspaces (single-tenant migration).
//
// Usage:
//   NEON_DB_URL="postgresql://..." npx tsx scripts/migrate-to-shared-workspace.ts

import { PrismaClient } from '@prisma/client'

const NEON_URL = process.env.NEON_DB_URL
const SHARED_PROJECT_ID = 'seed-project-n5deal'
if (!NEON_URL) { console.error('Set NEON_DB_URL'); process.exit(1) }

const neon = new PrismaClient({ datasources: { db: { url: NEON_URL } } })

async function main() {
  const shared = await neon.project.findUnique({ where: { id: SHARED_PROJECT_ID } })
  if (!shared) throw new Error(`Shared project ${SHARED_PROJECT_ID} not found`)

  const users = await neon.user.findMany()
  console.log(`Processing ${users.length} users...`)

  for (const u of users) {
    // Ensure member of shared project
    await neon.projectMember.upsert({
      where: { projectId_userId: { projectId: SHARED_PROJECT_ID, userId: u.id } },
      update: {},
      create: { projectId: SHARED_PROJECT_ID, userId: u.id, role: u.role === 'admin' ? 'admin' : 'member' },
    })

    // Delete any personal projects (other than the shared one) the user owns
    const personalOwned = await neon.project.findMany({
      where: { ownerId: u.id, NOT: { id: SHARED_PROJECT_ID } },
    })
    for (const p of personalOwned) {
      // Cascade: ProjectMember, ICP, Platform, Tag, RedFlagWord, etc. tied to it
      await neon.project.delete({ where: { id: p.id } })
      console.log(`  ${u.email}: removed personal project "${p.name}"`)
    }

    console.log(`  ✓ ${u.email}: member of shared project (${u.role})`)
  }

  // Final state
  const finalProjects = await neon.project.findMany()
  console.log(`\nFinal projects on Neon (${finalProjects.length}):`)
  finalProjects.forEach((p) => console.log(`  - ${p.id} "${p.name}"`))

  await neon.$disconnect()
}

main().catch(async (e) => {
  console.error('ERROR:', e.message)
  await neon.$disconnect().catch(() => {})
  process.exit(1)
})
