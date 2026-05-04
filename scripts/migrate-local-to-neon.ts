// One-shot migration: copy seed-project-n5deal data from local Postgres → Neon.
// Also wires up Andriy as admin member of the seed project on Neon and removes
// his empty auto-created workspace so the UI shows the populated project.
//
// Usage:
//   LOCAL_DB_URL="postgresql://...localhost..." \
//   NEON_DB_URL="postgresql://...neon.tech..." \
//   npx tsx scripts/migrate-local-to-neon.ts

import { PrismaClient } from '@prisma/client'

const LOCAL_URL = process.env.LOCAL_DB_URL
const NEON_URL = process.env.NEON_DB_URL
const ANDRIY_EMAIL = 'andriy.krechkivsky@gmail.com'
const PROJECT_ID = 'seed-project-n5deal'

if (!LOCAL_URL || !NEON_URL) {
  console.error('Set LOCAL_DB_URL and NEON_DB_URL env vars before running.')
  process.exit(1)
}

const local = new PrismaClient({ datasources: { db: { url: LOCAL_URL } } })
const neon = new PrismaClient({ datasources: { db: { url: NEON_URL } } })

async function main() {
  // -------------------------------------------------------------------------
  // 1. Verify both DBs see the seed project
  // -------------------------------------------------------------------------
  const localProject = await local.project.findUnique({ where: { id: PROJECT_ID } })
  const neonProject = await neon.project.findUnique({ where: { id: PROJECT_ID } })
  if (!localProject) throw new Error(`Local DB missing project ${PROJECT_ID}`)
  if (!neonProject) throw new Error(`Neon DB missing project ${PROJECT_ID}`)
  console.log(`✓ Both DBs have project "${PROJECT_ID}"`)

  // -------------------------------------------------------------------------
  // 2. Find Andriy on Neon and find his empty workspace (if any)
  // -------------------------------------------------------------------------
  const andriy = await neon.user.findUnique({ where: { email: ANDRIY_EMAIL } })
  if (!andriy) throw new Error(`User ${ANDRIY_EMAIL} not found on Neon`)
  console.log(`✓ Found user ${andriy.email} on Neon (id: ${andriy.id})`)

  const emptyWorkspace = await neon.project.findFirst({
    where: { ownerId: andriy.id, NOT: { id: PROJECT_ID } },
  })

  // -------------------------------------------------------------------------
  // 3. Clear stale data in Neon's seed project (keep ICPs and InternalLinks)
  // -------------------------------------------------------------------------
  console.log('\nClearing stale Neon data for seed-project-n5deal...')
  // ICPTag deleted via Tag cascade; GeneratedContentICP via GeneratedContent cascade
  const delGCI = await neon.generatedContentICP.deleteMany({
    where: { generatedContent: { projectId: PROJECT_ID } },
  })
  const delGC = await neon.generatedContent.deleteMany({ where: { projectId: PROJECT_ID } })
  const delICPTag = await neon.iCPTag.deleteMany({ where: { icp: { projectId: PROJECT_ID } } })
  const delTag = await neon.tag.deleteMany({ where: { projectId: PROJECT_ID } })
  const delPlat = await neon.platform.deleteMany({ where: { projectId: PROJECT_ID } })
  const delRF = await neon.redFlagWord.deleteMany({ where: { projectId: PROJECT_ID } })
  console.log(
    `  cleared: Platform(${delPlat.count}), Tag(${delTag.count}), ICPTag(${delICPTag.count}), RedFlag(${delRF.count}), GenContent(${delGC.count}), GenContentICP(${delGCI.count})`,
  )

  // -------------------------------------------------------------------------
  // 4. Copy fresh data from local → Neon
  // -------------------------------------------------------------------------
  console.log('\nCopying data from local → Neon...')

  const platforms = await local.platform.findMany({ where: { projectId: PROJECT_ID } })
  for (const p of platforms) await neon.platform.create({ data: p })
  console.log(`  ✓ Platforms: ${platforms.length}`)

  const tags = await local.tag.findMany({ where: { projectId: PROJECT_ID } })
  for (const t of tags) await neon.tag.create({ data: t })
  console.log(`  ✓ Tags: ${tags.length}`)

  const redflags = await local.redFlagWord.findMany({ where: { projectId: PROJECT_ID } })
  for (const r of redflags) await neon.redFlagWord.create({ data: r })
  console.log(`  ✓ RedFlagWords: ${redflags.length}`)

  // ICPTag (junction) — only meaningful if ICPs exist on both sides with same IDs
  const localICPIds = new Set((await local.iCP.findMany({ where: { projectId: PROJECT_ID }, select: { id: true } })).map((i) => i.id))
  const neonICPIds = new Set((await neon.iCP.findMany({ where: { projectId: PROJECT_ID }, select: { id: true } })).map((i) => i.id))
  const icpTags = await local.iCPTag.findMany({ where: { icp: { projectId: PROJECT_ID } } })
  let icpTagCount = 0
  for (const it of icpTags) {
    if (!localICPIds.has(it.icpId) || !neonICPIds.has(it.icpId)) continue
    try {
      await neon.iCPTag.create({ data: it })
      icpTagCount++
    } catch {}
  }
  console.log(`  ✓ ICPTags: ${icpTagCount}/${icpTags.length}`)

  // GeneratedContent — reassign userId to Andriy (local userId may not exist on Neon)
  const generated = await local.generatedContent.findMany({ where: { projectId: PROJECT_ID } })
  let genCount = 0
  for (const g of generated) {
    try {
      const { briefData, ...rest } = g
      await neon.generatedContent.create({
        data: { ...rest, createdById: andriy.id, briefData: briefData ?? undefined },
      })
      genCount++
    } catch (e: any) {
      console.log(`    skip generated content ${g.id}: ${e.message?.slice(0, 80)}`)
    }
  }
  console.log(`  ✓ GeneratedContent: ${genCount}/${generated.length} (reassigned to Andriy)`)

  // GeneratedContentICP — copy junctions for the ones we just imported
  const importedGenIds = new Set((await neon.generatedContent.findMany({ where: { projectId: PROJECT_ID }, select: { id: true } })).map((g) => g.id))
  const genICPs = await local.generatedContentICP.findMany({ where: { generatedContent: { projectId: PROJECT_ID } } })
  let genICPCount = 0
  for (const gi of genICPs) {
    if (!importedGenIds.has(gi.generatedContentId)) continue
    if (!neonICPIds.has(gi.icpId)) continue
    try {
      await neon.generatedContentICP.create({ data: gi })
      genICPCount++
    } catch {}
  }
  console.log(`  ✓ GeneratedContentICP: ${genICPCount}/${genICPs.length}`)

  // -------------------------------------------------------------------------
  // 5. Add Andriy as admin member of seed-project-n5deal
  // -------------------------------------------------------------------------
  await neon.projectMember.upsert({
    where: { projectId_userId: { projectId: PROJECT_ID, userId: andriy.id } },
    update: { role: 'admin' },
    create: { projectId: PROJECT_ID, userId: andriy.id, role: 'admin' },
  })
  console.log(`\n✓ Andriy is now admin of "${PROJECT_ID}"`)

  // -------------------------------------------------------------------------
  // 6. Delete his empty auto-created workspace so the UI shows the seed project
  // -------------------------------------------------------------------------
  if (emptyWorkspace) {
    await neon.project.delete({ where: { id: emptyWorkspace.id } })
    console.log(`✓ Removed empty workspace "${emptyWorkspace.name}" (id: ${emptyWorkspace.id})`)
  } else {
    console.log('  (no empty workspace to remove)')
  }

  console.log('\n🎉 Migration complete.')
  await local.$disconnect()
  await neon.$disconnect()
}

main().catch(async (e) => {
  console.error('ERROR:', e.message)
  await local.$disconnect().catch(() => {})
  await neon.$disconnect().catch(() => {})
  process.exit(1)
})
