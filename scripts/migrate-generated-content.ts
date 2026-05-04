// Migrate GeneratedContent + GeneratedContentICP from local → Neon.
// Reassigns createdById to Andriy's Neon user (local userIds don't exist on Neon).
//
// Usage:
//   LOCAL_DB_URL="..." NEON_DB_URL="..." npx tsx scripts/migrate-generated-content.ts

import { PrismaClient } from '@prisma/client'

const LOCAL_URL = process.env.LOCAL_DB_URL
const NEON_URL = process.env.NEON_DB_URL
const ANDRIY_EMAIL = 'andriy.krechkivsky@gmail.com'
const PROJECT_ID = 'seed-project-n5deal'

if (!LOCAL_URL || !NEON_URL) {
  console.error('Set LOCAL_DB_URL and NEON_DB_URL.')
  process.exit(1)
}

const local = new PrismaClient({ datasources: { db: { url: LOCAL_URL } } })
const neon = new PrismaClient({ datasources: { db: { url: NEON_URL } } })

async function main() {
  const andriy = await neon.user.findUnique({ where: { email: ANDRIY_EMAIL } })
  if (!andriy) throw new Error(`User ${ANDRIY_EMAIL} not found on Neon`)
  console.log(`✓ Reassigning content to ${andriy.email} (id: ${andriy.id})`)

  const neonICPIds = new Set(
    (await neon.iCP.findMany({ where: { projectId: PROJECT_ID }, select: { id: true } })).map((i) => i.id),
  )

  // Clean any partial migration state
  await neon.generatedContentICP.deleteMany({ where: { generatedContent: { projectId: PROJECT_ID } } })
  await neon.generatedContent.deleteMany({ where: { projectId: PROJECT_ID } })

  const generated = await local.generatedContent.findMany({ where: { projectId: PROJECT_ID } })
  console.log(`Found ${generated.length} GeneratedContent rows in local`)

  let imported = 0
  for (const g of generated) {
    try {
      await neon.generatedContent.create({
        data: {
          id: g.id,
          projectId: g.projectId,
          createdById: andriy.id,
          contentType: g.contentType,
          topic: g.topic,
          targetAudience: g.targetAudience,
          keyMessages: g.keyMessages,
          tone: g.tone,
          generatedBrief: g.generatedBrief,
          briefData: g.briefData ?? undefined,
          createdAt: g.createdAt,
        },
      })
      imported++
    } catch (e: any) {
      console.log(`  ✗ ${g.id} (${g.contentType}): ${e.message?.split('\n')[0]?.slice(0, 120)}`)
    }
  }
  console.log(`✓ GeneratedContent: ${imported}/${generated.length}`)

  const importedIds = new Set(
    (await neon.generatedContent.findMany({ where: { projectId: PROJECT_ID }, select: { id: true } })).map((g) => g.id),
  )

  const junctions = await local.generatedContentICP.findMany({
    where: { generatedContent: { projectId: PROJECT_ID } },
  })
  let junctionsImported = 0
  for (const j of junctions) {
    if (!importedIds.has(j.generatedContentId)) continue
    if (!neonICPIds.has(j.icpId)) continue
    try {
      await neon.generatedContentICP.create({ data: j })
      junctionsImported++
    } catch {}
  }
  console.log(`✓ GeneratedContentICP: ${junctionsImported}/${junctions.length}`)

  await local.$disconnect()
  await neon.$disconnect()
}

main().catch(async (e) => {
  console.error('ERROR:', e.message)
  await local.$disconnect().catch(() => {})
  await neon.$disconnect().catch(() => {})
  process.exit(1)
})
