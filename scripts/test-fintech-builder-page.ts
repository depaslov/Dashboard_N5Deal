// Replays the user's reference Fintech Builder page through the Pages
// pipeline. Verifies: template wiring, keyword block, internal links,
// word count budget, document context.

import { assembleStudioPrompt } from '../lib/content-studio'
import { prisma } from '../lib/db'

const PROJECT_ID = 'seed-project-n5deal'

async function main() {
  const n5 = await prisma.platform.findFirst({ where: { projectId: PROJECT_ID, slug: 'n5-site' } })

  // Example keywords matching the reference PDF table.
  const mainKeywords = [
    { term: 'fintech startup', minCount: 2 },
    { term: 'fintech startups', minCount: 2 },
    { term: 'fintech startup companies', minCount: 1 },
    { term: 'fintech startup accelerator', minCount: 1 },
    { term: 'build fintech startup', minCount: 1 },
    { term: 'launch fintech company', minCount: 1 },
    { term: 'fintech infrastructure', minCount: 1 },
    { term: 'banking as a service', minCount: 1 },
    { term: 'fintech platform', minCount: 1 },
    { term: 'fintech solution provider', minCount: 1 },
    { term: 'fintech ecosystem', minCount: 1 },
    { term: 'neobank infrastructure', minCount: 1 },
    { term: 'fintech product development', minCount: 1 },
  ]

  const r = await assembleStudioPrompt({
    projectId: PROJECT_ID,
    contentType: 'pages',
    topic: 'What Is a Fintech Builder and How It Helps Launch a Fintech Startup',
    targetAudience: 'Founders, investors, operators evaluating a fintech launch',
    language: 'en',
    icpIds: [],
    platformId: n5?.id ?? null,
    mainKeywords,
    wordCountMin: 950,
    wordCountMax: 1000,
    documentText: 'TZ: Page should describe N5Deal Fintech Builder as a hands-on service. Cover: what is a fintech startup; how the builder simplifies launch; choosing the bank type / business model; choosing license, country, banking software; tools and infrastructure; final CTA.',
  })

  console.log(`Template:        ${r.meta.templateName}`)
  console.log(`Platform:        ${r.meta.platform?.name}`)
  console.log(`Internal links:  ${r.meta.internalLinkCount} loaded into context`)
  console.log(`KB sources:      ${r.meta.kbSources.length}`)
  console.log(`System prompt:   ${r.systemPrompt.length} chars`)
  console.log(`User prompt:     ${r.userPrompt.length} chars`)
  console.log(`≈ tokens:        ${Math.round((r.systemPrompt.length + r.userPrompt.length) / 3.5)}`)

  console.log('\n--- KEYWORD BLOCK IN USER PROMPT ---')
  const m = r.userPrompt.match(/# Main SEO keywords[\s\S]*?(?=\n#|$)/)
  console.log(m ? m[0].slice(0, 800) : '(not found)')

  console.log('\n--- INTERNAL LINKS BLOCK ---')
  const il = r.userPrompt.match(/# Internal links[\s\S]*?(?=\n#|$)/)
  console.log(il ? il[0].slice(0, 800) : '(not found)')

  console.log('\n--- WORD COUNT LINE ---')
  const wc = r.userPrompt.match(/^\*\*Word Count:\*\*.*$/m)
  console.log(wc ? wc[0] : '(not found)')

  console.log('\n--- SYSTEM PROMPT (first 800 chars) ---')
  console.log(r.systemPrompt.slice(0, 800))
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
