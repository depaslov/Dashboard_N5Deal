// End-to-end test of the prompt-assembly flow without going through HTTP/auth.
// Mirrors what /api/content/assemble-prompt does via the shared library.

import { assembleStudioPrompt } from '../lib/content-studio'
import { prisma } from '../lib/db'

const PROJECT_ID = 'seed-project-n5deal'

async function main() {
  // Pick first ICP and Medium platform
  const icps = await prisma.iCP.findMany({ where: { projectId: PROJECT_ID }, take: 2, select: { id: true, name: true } })
  const medium = await prisma.platform.findFirst({ where: { projectId: PROJECT_ID, slug: 'medium' } })
  const li = await prisma.platform.findFirst({ where: { projectId: PROJECT_ID, slug: 'linkedin-post' } })

  console.log('='.repeat(60))
  console.log('TEST 1 — Articles + Medium')
  console.log('='.repeat(60))
  const r1 = await assembleStudioPrompt({
    projectId: PROJECT_ID,
    contentType: 'articles',
    topic: 'How fintech founders should think about MiCA timeline and ready-made VASP licenses',
    targetAudience: 'Crypto Founder (VASP)',
    language: 'en',
    icpIds: icps.map((i) => i.id),
    platformId: medium?.id ?? null,
  })
  console.log(`Template: ${r1.meta.templateName}`)
  console.log(`Platform: ${r1.meta.platform?.name}`)
  console.log(`KB sources (${r1.meta.kbSources.length}):`, r1.meta.kbSources.slice(0, 3).join('  |  '))
  console.log(`ICP tags: ${r1.meta.icpTags.join(', ')}`)
  console.log(`System prompt: ${r1.systemPrompt.length} chars`)
  console.log(`User prompt:   ${r1.userPrompt.length} chars`)
  console.log('\n--- USER PROMPT (first 500 chars) ---')
  console.log(r1.userPrompt.slice(0, 500))

  console.log('\n' + '='.repeat(60))
  console.log('TEST 2 — Social + LinkedIn Post')
  console.log('='.repeat(60))
  const r2 = await assembleStudioPrompt({
    projectId: PROJECT_ID,
    contentType: 'social',
    topic: 'Why ready-made fintech licenses save 6 months of regulatory friction',
    targetAudience: 'Fintech Founders on LinkedIn',
    language: 'en',
    icpIds: [icps[0].id],
    platformId: li?.id ?? null,
  })
  console.log(`Template: ${r2.meta.templateName}`)
  console.log(`Platform: ${r2.meta.platform?.name}`)
  console.log(`Total prompt size: ${r2.systemPrompt.length + r2.userPrompt.length} chars (≈ ${Math.round((r2.systemPrompt.length + r2.userPrompt.length) / 3.5)} tokens)`)

  console.log('\n' + '='.repeat(60))
  console.log('TEST 3 — Market News (no platform)')
  console.log('='.repeat(60))
  const r3 = await assembleStudioPrompt({
    projectId: PROJECT_ID,
    contentType: 'market-news',
    topic: 'EU MiCA enforcement Q3 2026',
    sourceUrl: 'https://example.com/source-article',
    documentText: 'The EU has rolled out MiCA enforcement actions...',
    language: 'en',
  })
  console.log(`Template: ${r3.meta.templateName}`)
  console.log(`User prompt has source URL: ${r3.userPrompt.includes('example.com')}`)
  console.log(`User prompt has source text: ${r3.userPrompt.includes('rolled out MiCA enforcement')}`)
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
