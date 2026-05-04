// Verify the new Pages content type assembles correctly. Mimics what the
// bulk loop does: assembles one prompt per item, each with that item as topic.

import { assembleStudioPrompt } from '../lib/content-studio'
import { prisma } from '../lib/db'

const PROJECT_ID = 'seed-project-n5deal'

async function main() {
  const n5 = await prisma.platform.findFirst({ where: { projectId: PROJECT_ID, slug: 'n5-site' } })

  const items = [
    'EMI license — UK',
    'EMI license — Lithuania',
    'VASP license — Poland',
  ]

  console.log(`Bulk assembly: ${items.length} items, platform=${n5?.name}\n`)
  for (const topic of items) {
    const r = await assembleStudioPrompt({
      projectId: PROJECT_ID,
      contentType: 'pages',
      topic,
      targetAudience: 'Founders shopping for licenses',
      language: 'en',
      icpIds: [],
      platformId: n5?.id ?? null,
      documentText: 'Sample TZ: page should cover overview, requirements, timeline, who it is for, FAQ.',
    })
    console.log(`"${topic}"`)
    console.log(`  Template: ${r.meta.templateName}`)
    console.log(`  KB sources (${r.meta.kbSources.length}):`, r.meta.kbSources.slice(0, 2).join(' | '))
    console.log(`  System: ${r.systemPrompt.length} chars  User: ${r.userPrompt.length} chars`)
    const refMentioned = r.userPrompt.includes('Sample TZ')
    const topicMentioned = r.userPrompt.includes(topic)
    console.log(`  Topic substituted: ${topicMentioned}  Reference doc included: ${refMentioned}`)
    console.log()
  }
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
