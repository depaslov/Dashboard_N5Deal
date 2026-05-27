// One-shot, NON-DESTRUCTIVE push of locally-generated content to Neon.
//
// What it does:
//   - Reads GeneratedContent + CompanyInfoSection from LOCAL_DB_URL
//   - For each row whose `id` does NOT already exist on NEON_DB_URL, inserts it
//   - Reassigns createdById to Andriy on Neon (local userIds may not exist there)
//   - Skips anything that already exists — never deletes anything
//
// Use this once to backfill content before switching DATABASE_URL in .env
// to point at Neon directly. After the switch, no further sync is needed.
//
// Usage:
//   LOCAL_DB_URL="postgresql://...localhost..." \
//   NEON_DB_URL="postgresql://...neon.tech..." \
//   npx tsx scripts/push-new-content-to-neon.ts

import { PrismaClient } from '@prisma/client'

const LOCAL_URL = process.env.LOCAL_DB_URL
const NEON_URL = process.env.NEON_DB_URL
const ANDRIY_EMAIL = process.env.ANDRIY_EMAIL || 'andriy.krechkivsky@gmail.com'
const PROJECT_ID = process.env.PROJECT_ID || 'seed-project-n5deal'

if (!LOCAL_URL || !NEON_URL) {
  console.error('Set LOCAL_DB_URL and NEON_DB_URL env vars before running.')
  console.error('Find your Neon URL in Vercel → Settings → Environment Variables → DATABASE_URL.')
  process.exit(1)
}

const local = new PrismaClient({ datasources: { db: { url: LOCAL_URL } } })
const neon = new PrismaClient({ datasources: { db: { url: NEON_URL } } })

async function main() {
  // ── 1. Sanity-check both DBs see the seed project ────────────────────────
  const localProject = await local.project.findUnique({ where: { id: PROJECT_ID } })
  const neonProject = await neon.project.findUnique({ where: { id: PROJECT_ID } })
  if (!localProject) throw new Error(`Local DB missing project ${PROJECT_ID}`)
  if (!neonProject) throw new Error(`Neon DB missing project ${PROJECT_ID}`)
  console.log(`✓ Both DBs have project "${PROJECT_ID}"`)

  // ── 2. Locate Andriy on Neon (used as createdById for any reassignment) ─
  const andriy = await neon.user.findUnique({ where: { email: ANDRIY_EMAIL } })
  if (!andriy) throw new Error(`User ${ANDRIY_EMAIL} not found on Neon`)
  console.log(`✓ Found user ${andriy.email} on Neon (id: ${andriy.id})`)

  // ── 3. Push GeneratedContent (skip rows whose id already exists on Neon) ─
  const localGen = await local.generatedContent.findMany({ where: { projectId: PROJECT_ID } })
  const neonGenIds = new Set(
    (await neon.generatedContent.findMany({ where: { projectId: PROJECT_ID }, select: { id: true } })).map((g) => g.id),
  )
  console.log(`\nGeneratedContent: ${localGen.length} on local, ${neonGenIds.size} on Neon`)

  let inserted = 0
  let skipped = 0
  let failed = 0
  for (const g of localGen) {
    if (neonGenIds.has(g.id)) { skipped++; continue }
    try {
      const { briefData, ...rest } = g
      await neon.generatedContent.create({
        data: { ...rest, createdById: andriy.id, briefData: briefData ?? undefined },
      })
      inserted++
      console.log(`  + ${g.id.slice(0, 12)}… ${(g.topic ?? '').slice(0, 60)}`)
    } catch (e: any) {
      failed++
      console.log(`  ✗ ${g.id.slice(0, 12)}… ${e.message?.slice(0, 100)}`)
    }
  }
  console.log(`  → inserted: ${inserted}, skipped (already on Neon): ${skipped}, failed: ${failed}`)

  // ── 4. GeneratedContentICP junctions for newly-inserted rows ────────────
  if (inserted > 0) {
    const newGenIds = new Set(
      (await neon.generatedContent.findMany({ where: { projectId: PROJECT_ID }, select: { id: true } })).map((g) => g.id),
    )
    const neonIcpIds = new Set(
      (await neon.iCP.findMany({ where: { projectId: PROJECT_ID }, select: { id: true } })).map((i) => i.id),
    )
    const localJunctions = await local.generatedContentICP.findMany({
      where: { generatedContent: { projectId: PROJECT_ID } },
    })
    let jInserted = 0
    for (const j of localJunctions) {
      if (!newGenIds.has(j.generatedContentId)) continue
      if (!neonIcpIds.has(j.icpId)) continue
      try {
        await neon.generatedContentICP.create({ data: j })
        jInserted++
      } catch {
        // Already exists or constraint failure — skip silently.
      }
    }
    console.log(`  → GeneratedContentICP junctions inserted: ${jInserted}`)
  }

  // ── 5. CompanyInfoSection (the Company tab) ─────────────────────────────
  // Only if the model exists — older Neon schemas may not have it yet.
  try {
    const localSections = await (local as any).companyInfoSection.findMany({
      where: { projectId: PROJECT_ID },
    })
    const neonSectionIds = new Set(
      ((await (neon as any).companyInfoSection.findMany({
        where: { projectId: PROJECT_ID },
        select: { id: true },
      })) as { id: string }[]).map((s) => s.id),
    )
    console.log(`\nCompanyInfoSection: ${localSections.length} on local, ${neonSectionIds.size} on Neon`)
    let secInserted = 0
    let secSkipped = 0
    for (const s of localSections) {
      if (neonSectionIds.has(s.id)) { secSkipped++; continue }
      try {
        await (neon as any).companyInfoSection.create({ data: s })
        secInserted++
        console.log(`  + ${s.id.slice(0, 12)}… ${(s.title ?? '').slice(0, 60)}`)
      } catch (e: any) {
        console.log(`  ✗ ${s.id.slice(0, 12)}… ${e.message?.slice(0, 100)}`)
      }
    }
    console.log(`  → inserted: ${secInserted}, skipped: ${secSkipped}`)
  } catch (e: any) {
    console.log(`\nCompanyInfoSection table missing or empty on one side — skipping (${e.message?.slice(0, 80)})`)
  }

  console.log('\n✓ Push complete. Nothing on Neon was deleted.')
  console.log('Next step: update DATABASE_URL in .env to the Neon URL,')
  console.log('then restart `npm run dev`. After that, localhost writes go straight to Neon.')

  await local.$disconnect()
  await neon.$disconnect()
}

main().catch(async (e) => {
  console.error('ERROR:', e.message)
  await local.$disconnect().catch(() => {})
  await neon.$disconnect().catch(() => {})
  process.exit(1)
})
