// Verify the rewritten Pages template renders correctly with the new fields:
// - System prompt verbatim from user
// - Primary keyword vs secondary keywords split
// - Section outline injected
// - Audience priority (primary + secondary)
// - Source data usage rules + format constraints + tone examples present

import { assembleStudioPrompt } from '../lib/content-studio'
import { prisma } from '../lib/db'

const PROJECT_ID = 'seed-project-n5deal'

async function main() {
  const n5 = await prisma.platform.findFirst({ where: { projectId: PROJECT_ID, slug: 'n5-site' } })

  const r = await assembleStudioPrompt({
    projectId: PROJECT_ID,
    contentType: 'pages',
    topic: 'EMI Licence Acquisition for Cross-Border Fintech Founders',
    targetAudience: 'Buyers (founders evaluating an EMI acquisition)',
    secondaryAudience: 'Sellers (existing EMI license holders open to a sale)',
    sectionOutline: [
      'What Is an EMI Licence and How Does the Industry Work?',
      'How Does N5Deal Support EMI Licence Acquisition?',
      'Buy Your EMI Licence Step by Step',
      'Choose the Right Country and Licence Scope',
      'What Tools and Infrastructure Should You Plan For?',
      'What Is the Next Step?',
    ],
    language: 'en',
    icpIds: [],
    platformId: n5?.id ?? null,
    mainKeywords: [
      { term: 'EMI licence', minCount: 6 },
      { term: 'EMI license', minCount: 3 },
      { term: 'buy EMI licence', minCount: 2 },
      { term: 'electronic money institution', minCount: 2 },
      { term: 'licensed business marketplace', minCount: 1 },
      { term: 'fintech licence', minCount: 1 },
    ],
    wordCountMin: 950,
    wordCountMax: 1000,
    documentText: 'TZ: Page covers EMI licence acquisition through the N5Deal marketplace. Audience: founders considering buying an existing EMI vs applying. Address timeline trade-offs without quoting specific costs.',
  })

  console.log(`Template:        ${r.meta.templateName}`)
  console.log(`System prompt:   ${r.systemPrompt.length} chars`)
  console.log(`User prompt:     ${r.userPrompt.length} chars`)
  console.log(`Internal links:  ${r.meta.internalLinkCount}`)
  console.log(`KB sources:      ${r.meta.kbSources.length}`)
  console.log()

  const checks: { name: string; pass: boolean; needle: string }[] = [
    // System prompt — verbatim user text
    { name: 'sys: PLATFORM IDENTITY block', needle: 'PLATFORM IDENTITY (apply to every sentence)', pass: false },
    { name: 'sys: Founders make their own decisions', needle: '"Founders make their own decisions."', pass: false },
    { name: 'sys: max 2-3 lists rule', needle: 'max 2–3 lists per page', pass: false },
    { name: 'sys: ban Summary block', needle: 'Do NOT include a Summary block', pass: false },
    { name: 'sys: ban raw price data', needle: 'Do NOT use raw price data', pass: false },
    { name: 'sys: standard section flow', needle: 'STANDARD SECTION FLOW', pass: false },
    { name: 'sys: disclaimer wording', needle: 'This page is for informational purposes only', pass: false },
    { name: 'sys: BEGIN OUTPUT line', needle: "BEGIN OUTPUT with: '**Word Count:** N words'", pass: false },
  ]
  for (const c of checks) c.pass = r.systemPrompt.includes(c.needle)

  const userChecks: { name: string; pass: boolean; needle: string }[] = [
    { name: 'user: audience priority Primary', needle: 'Primary: Buyers (founders evaluating', pass: false },
    { name: 'user: audience priority Secondary', needle: 'Secondary: Sellers (existing EMI license', pass: false },
    { name: 'user: section outline injected', needle: '1. What Is an EMI Licence and How Does the Industry Work?', pass: false },
    { name: 'user: section outline 6th heading', needle: '6. What Is the Next Step?', pass: false },
    { name: 'user: PRIMARY keyword block', needle: 'Primary keyword (use in H1', pass: false },
    { name: 'user: primary keyword content', needle: '"EMI licence" — bold every natural appearance, target min 6×', pass: false },
    { name: 'user: secondary keywords block', needle: 'Secondary keywords with frequencies', pass: false },
    { name: 'user: source data rules', needle: 'Source data usage rules', pass: false },
    { name: 'user: max 3 lists', needle: 'Maximum 3 bullet lists', pass: false },
    { name: 'user: NEVER place a Summary', needle: 'NEVER place a Summary block', pass: false },
    { name: 'user: tone good example', needle: 'The platform provides information', pass: false },
    { name: 'user: tone bad example', needle: 'N5Deal advises founders', pass: false },
    { name: 'user: TZ document present', needle: 'EMI licence acquisition through the N5Deal marketplace', pass: false },
    { name: 'user: internal links MUST hint', needle: 'MUST links are mandatory in this page', pass: false },
  ]
  for (const c of userChecks) c.pass = r.userPrompt.includes(c.needle)

  console.log('--- SYSTEM PROMPT CHECKS ---')
  for (const c of checks) console.log(`  ${c.pass ? '✅' : '❌'} ${c.name}`)
  console.log('\n--- USER PROMPT CHECKS ---')
  for (const c of userChecks) console.log(`  ${c.pass ? '✅' : '❌'} ${c.name}`)

  const total = [...checks, ...userChecks]
  const passed = total.filter((c) => c.pass).length
  console.log(`\n${passed}/${total.length} checks passed`)
  if (passed !== total.length) process.exit(1)
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
