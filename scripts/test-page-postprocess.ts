// Sanity check for postProcessPage — runs against a synthetic page that
// reproduces every failure mode from the recent reviews.

import { postProcessPage } from '../lib/prompts/page-postprocess'

const synthetic = `# CFA license: complete guide

## What Is a CFA license and Who Needs It?

A CFA license is the BVI's framework for financial services.

## Why is a CFA license essential for financial companies

It matters for compliance.

## How to obtain a CFA license in the BVI

The process involves several steps and a [licensed business marketplace](/marketplace) review.

The [marketplace of licensed companies](/marketplace) helps. See also [crypto license](/crypto-license) for related topics. [frequently asked questions](/faq) cover this.

## CFA license costs, compliance, and structure

A CFA license is necessary.

## What is the next step?

Visit the [licensed business marketplace](/marketplace) again.`

const result = postProcessPage(synthetic, {
  primaryKeyword: { term: 'CFA license', minCount: 5 }, // MAX = 6 with the tightened formula
  secondaryKeywords: [],
  lsiKeywords: ['BVI financial services', 'fintech licensing'],
  internalLinks: [
    { url: '/marketplace', anchor: 'licensed business marketplace' },
    { url: '/faq', anchor: 'frequently asked questions' },
    { url: '/buyer', anchor: 'buy a licensed business' },
  ],
  topic: 'CFA license guide',
})

console.log('\n=== FIXES APPLIED ===')
for (const f of result.fixes) console.log(' -', f)
console.log('\n=== FINAL TEXT ===')
console.log(result.text)
console.log('\n=== STATS ===')
const kwCount = (result.text.match(/CFA license/gi) ?? []).length
console.log('CFA license occurrences:', kwCount)
const linkMatches = result.text.match(/\[([^\]]+)\]\(([^)]+)\)/g) ?? []
console.log('Internal links:', linkMatches.length)
linkMatches.forEach((l) => console.log(' -', l))
const startsWithMeta = /^\*\*Word Count:\*\*/i.test(result.text.trimStart())
console.log('Starts with metadata header:', startsWithMeta)
