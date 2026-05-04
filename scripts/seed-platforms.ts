// Seed common publishing platforms per TT Section 5.
// Idempotent: upserts on (projectId, slug).

import { prisma } from '../lib/db'

const PROJECT_ID = 'seed-project-n5deal'

interface Seed {
  name: string
  slug: string
  formatType: 'article' | 'post' | 'newsletter' | 'thread' | 'video-description' | 'other'
  minLength: number | null
  maxLength: number | null
  lengthUnit: 'chars' | 'words'
  tone: string | null
  hashtagRules: string | null
  disclaimers: string | null
  promptFragment: string | null
}

const PLATFORMS: Seed[] = [
  {
    name: 'Medium',
    slug: 'medium',
    formatType: 'article',
    minLength: 800, maxLength: 2500, lengthUnit: 'words',
    tone: 'Conversational-professional. Long-form, story-driven. Subheadings encouraged.',
    hashtagRules: 'Up to 5 topical tags at the bottom (Medium "tags", not hashtags). No promo tags.',
    disclaimers: null,
    promptFragment: 'Write a Medium-style article. Use H2/H3 subheadings, scannable paragraphs (2-4 sentences), one or two pull quotes. Open with a hook in the first 2 sentences. End with a clear takeaway.',
  },
  {
    name: 'LinkedIn Newsletter',
    slug: 'linkedin-newsletter',
    formatType: 'newsletter',
    minLength: 600, maxLength: 1500, lengthUnit: 'words',
    tone: 'Authoritative but approachable. Practitioner-to-practitioner.',
    hashtagRules: 'Max 3-5 hashtags at the very end. No #invest, #trading, #financialadvisor, #wealthmanagement, #passiveincome, #guaranteedreturns.',
    disclaimers: 'If the source is a Medium article, include a backlink to the Medium original to avoid duplicate-content issues.',
    promptFragment: 'Write a LinkedIn Newsletter issue. Strong hook in the first 2 lines. Section with a single takeaway each. Add a CTA to subscribe at the end.',
  },
  {
    name: 'LinkedIn Post',
    slug: 'linkedin-post',
    formatType: 'post',
    minLength: 100, maxLength: 1300, lengthUnit: 'chars',
    tone: 'Conversational, scroll-stopping first line, no jargon dumps.',
    hashtagRules: 'Max 3-5 relevant hashtags at the very end. No banned hashtags.',
    disclaimers: null,
    promptFragment: 'Write a LinkedIn post. First 2 lines must be a hook (LinkedIn collapses after ~210 chars). Use short lines, line breaks between thoughts, single CTA at the end.',
  },
  {
    name: 'Reddit',
    slug: 'reddit',
    formatType: 'post',
    minLength: null, maxLength: 40000, lengthUnit: 'chars',
    tone: 'Plain, conversational, no marketing speak. Reddit users smell promo from a mile away.',
    hashtagRules: 'No hashtags. No emojis in title.',
    disclaimers: 'If posting in a subreddit that requires self-disclosure, mention you work for the platform up front.',
    promptFragment: 'Write a Reddit post (text-post). Title is short and specific. Body avoids promotional language; share insight first, ask for opinions, link only if directly relevant.',
  },
  {
    name: 'X (Twitter)',
    slug: 'x',
    formatType: 'post',
    minLength: null, maxLength: 280, lengthUnit: 'chars',
    tone: 'Punchy. One idea per post.',
    hashtagRules: 'Max 2 hashtags. No banned hashtags.',
    disclaimers: null,
    promptFragment: 'Write a single X (Twitter) post under 280 chars. One idea, sharp phrasing.',
  },
  {
    name: 'X Thread',
    slug: 'x-thread',
    formatType: 'thread',
    minLength: 5, maxLength: 15, lengthUnit: 'chars', // count of posts in thread, repurposed unit
    tone: 'Hook → escalate → payoff. Each post pulls into the next.',
    hashtagRules: 'No hashtags except possibly one at the very end.',
    disclaimers: null,
    promptFragment: 'Write an X (Twitter) thread of 7-10 posts. Post 1 is the hook (curiosity gap). Each post stands alone but carries forward. Final post has a single CTA.',
  },
  {
    name: 'N5 site',
    slug: 'n5-site',
    formatType: 'article',
    minLength: 800, maxLength: 3500, lengthUnit: 'words',
    tone: 'Professional, trust-building. Plain English; minimal jargon.',
    hashtagRules: null,
    disclaimers: 'Append the standard N5Deal disclaimer in the footer (introducer-only role, no investment advice).',
    promptFragment: 'Write a long-form blog post for the n5deal.com site. Clear H2 structure, internal links to relevant pages, summary box at the top.',
  },
  {
    name: 'Telegram',
    slug: 'telegram',
    formatType: 'post',
    minLength: null, maxLength: 4096, lengthUnit: 'chars',
    tone: 'Direct, scannable. Use • bullets and short paragraphs.',
    hashtagRules: 'No banned hashtags. Topic hashtags optional at the end.',
    disclaimers: null,
    promptFragment: 'Write a Telegram channel post. Open with an emoji hook, tiny paragraphs, bullets where useful, single CTA + link placeholder at the end.',
  },
  {
    name: 'Bankstore site',
    slug: 'bankstore-site',
    formatType: 'article',
    minLength: 800, maxLength: 3000, lengthUnit: 'words',
    tone: 'Professional, regulatory-aware. Tailored to banking M&A audience.',
    hashtagRules: null,
    disclaimers: 'Append Bankstore disclaimer. Mirror N5Deal compliance constraints.',
    promptFragment: 'Write a long-form post for the Bankstore site, banking-focused angle. H2 structure, internal links where relevant.',
  },
]

async function main() {
  let created = 0, updated = 0
  for (const p of PLATFORMS) {
    const before = await prisma.platform.findUnique({
      where: { projectId_slug: { projectId: PROJECT_ID, slug: p.slug } },
    })
    await prisma.platform.upsert({
      where: { projectId_slug: { projectId: PROJECT_ID, slug: p.slug } },
      create: { projectId: PROJECT_ID, ...p, isActive: true },
      update: { ...p },
    })
    if (before) updated++
    else created++
  }
  console.log(`Platforms — created: ${created}, updated: ${updated}, total in seed: ${PLATFORMS.length}`)
  const all = await prisma.platform.findMany({
    where: { projectId: PROJECT_ID },
    orderBy: { name: 'asc' },
    select: { name: true, slug: true, formatType: true, isActive: true },
  })
  console.log('\nPlatforms now in DB:')
  for (const p of all) {
    console.log(`  - ${p.name.padEnd(22)} ${p.slug.padEnd(22)} ${p.formatType.padEnd(12)} ${p.isActive ? 'active' : 'inactive'}`)
  }
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
