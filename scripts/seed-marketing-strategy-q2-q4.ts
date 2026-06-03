// Imports the full Q2 Marketing Strategy doc (April baseline → Q4 authority
// layer) into MarketingStrategy for the seed project.
//
// Idempotent and edit-safe:
//   - `actual` values in budgets and goals are NEVER overwritten — only set
//     on rows that are being created for the first time. User edits persist.
//   - Directive bodies / current-state diagnosis / authority-layer narrative
//     are ONLY written when those fields are still empty in DB.
//   - Safe to re-run after the strategy gets manually adjusted in the UI.
//
// Usage (local):
//   npx tsx --require dotenv/config scripts/seed-marketing-strategy-q2-q4.ts
// Against Neon:
//   DATABASE_URL="<neon>" npx tsx scripts/seed-marketing-strategy-q2-q4.ts

import { prisma } from '../lib/db'

const PROJECT_ID = process.env.PROJECT_ID || 'seed-project-n5deal'

// ─────────────────────────────────────────────────────────────────────────────
// BUDGETS — April / May / June (monthly) + Q3 / Q4 (quarterly buckets)
// Telegram is a new channel added across the whole timeline per PDF Part 6.
// ─────────────────────────────────────────────────────────────────────────────
type BudgetRow = { min: number; max: number; actual: number; purpose: string }

const APRIL_BUDGET: Record<string, BudgetRow> = {
  linkBuilding: { min: 1300, max: 1800, actual: 0, purpose: 'Validate rankings + CTR' },
  linkedin:     { min: 600,  max: 600,  actual: 0, purpose: 'Test audience + intent' },
  instagram:    { min: 0,    max: 300,  actual: 0, purpose: 'Rebuild, not scale' },
  pr:           { min: 300,  max: 800,  actual: 191, purpose: 'Credibility layer (already $191 PR links spent)' },
  telegram:     { min: 500,  max: 1200, actual: 0, purpose: 'Core audience acquisition via parsing' },
  free:         { min: 0,    max: 0,    actual: 0, purpose: 'Free linkbuilding + distribution' },
}

const MAY_BUDGET: Record<string, BudgetRow> = {
  linkBuilding: { min: 1800, max: 2500, actual: 0, purpose: 'Push pages into higher positions' },
  linkedin:     { min: 1000, max: 1500, actual: 0, purpose: 'Scale winning audience + creatives' },
  instagram:    { min: 300,  max: 600,  actual: 0, purpose: 'Controlled testing — new structure' },
  pr:           { min: 800,  max: 1500, actual: 0, purpose: 'Stronger placements + authority' },
  telegram:     { min: 1000, max: 2000, actual: 0, purpose: 'Parsing + first paid channel placements' },
  free:         { min: 0,    max: 0,    actual: 0, purpose: 'Continue distribution' },
}

const JUNE_BUDGET: Record<string, BudgetRow> = {
  linkBuilding: { min: 2500, max: 3500, actual: 0, purpose: 'Strengthen positions + expand keywords' },
  linkedin:     { min: 2000, max: 3000, actual: 0, purpose: 'Stable acquisition channel' },
  instagram:    { min: 800,  max: 1200, actual: 0, purpose: 'Support channel — awareness + retarget' },
  pr:           { min: 1500, max: 3000, actual: 0, purpose: 'Consistent visibility in market' },
  telegram:     { min: 1500, max: 2500, actual: 0, purpose: 'Full Telegram engine: parsing + placements + native ads test' },
  free:         { min: 0,    max: 0,    actual: 0, purpose: 'Ongoing support' },
}

const Q3_BUDGET: Record<string, BudgetRow> = {
  linkBuilding: { min: 2500, max: 3500, actual: 0, purpose: 'Push core pages into top 10, expand secondary keywords' },
  linkedin:     { min: 2000, max: 3000, actual: 0, purpose: 'Scale what worked in Q2, event + report promotion' },
  instagram:    { min: 800,  max: 1200, actual: 0, purpose: 'Awareness, retargeting, clip distribution' },
  pr:           { min: 1500, max: 3000, actual: 0, purpose: 'Placements tied to report releases + event angles' },
  telegram:     { min: 1500, max: 2500, actual: 0, purpose: 'Ongoing — referencing events, growth via parsing + placements' },
  events:       { min: 1500, max: 3000, actual: 0, purpose: '3 online events — production, speakers, promotion' },
  california:   { min: 8000, max: 15000, actual: 0, purpose: 'California offline event — venue, production, content creator, logistics' },
  free:         { min: 0,    max: 0,    actual: 0, purpose: 'Ongoing, systematized' },
}

const Q4_BUDGET: Record<string, BudgetRow> = {
  linkBuilding: { min: 3000, max: 4000, actual: 0, purpose: 'Expand keyword base, push Q3 event content into rankings' },
  linkedin:     { min: 2500, max: 3500, actual: 0, purpose: 'Stable acquisition channel, post-event content cycle' },
  instagram:    { min: 1000, max: 1500, actual: 0, purpose: 'Retargeting, podcast clips, report promotion' },
  pr:           { min: 2000, max: 4000, actual: 0, purpose: 'Full report launch, post-California coverage, year-end positioning' },
  telegram:     { min: 1500, max: 2500, actual: 0, purpose: 'Maintenance — distribution of reports + post-event clips' },
  events:       { min: 2000, max: 4000, actual: 0, purpose: 'One or two targeted online events — no major offline' },
  free:         { min: 0,    max: 0,    actual: 0, purpose: 'Ongoing' },
}

const BUDGET_DEFAULTS: Record<string, Record<string, BudgetRow>> = {
  april: APRIL_BUDGET,
  may:   MAY_BUDGET,
  june:  JUNE_BUDGET,
  q3:    Q3_BUDGET,
  q4:    Q4_BUDGET,
}

// ─────────────────────────────────────────────────────────────────────────────
// GOALS — per-channel target metrics drawn directly from the PDF
// ─────────────────────────────────────────────────────────────────────────────
const GOALS_DEFAULT = {
  seo: {
    impressions: { baseline: 1890, target: 4000, actual: 1890, unit: '',  label: 'Impressions' },
    ctr:         { baseline: 1.6,  target: 2.75, actual: 1.6,  unit: '%', label: 'CTR' },
    clicks:      { baseline: 31,   target: 90,   actual: 31,   unit: '',  label: 'Clicks' },
  },
  linkedin: {
    followers:           { baseline: 710, target: 850, actual: 710, unit: '',  label: 'Followers' },
    newFollowers:        { baseline: 37,  target: 60,  actual: 37,  unit: '',  label: 'New Followers' },
    visitorFollowConv:   { baseline: 34,  target: 34,  actual: 34,  unit: '%', label: 'Visitor → Follow' },
    adCtr:               { baseline: 0,   target: 1.0, actual: 0,   unit: '%', label: 'Ad CTR' },
    pageAction:          { baseline: 0,   target: 4,   actual: 0,   unit: '%', label: 'Page → Action' },
    avgTimeOnPage:       { baseline: 0,   target: 90,  actual: 0,   unit: 's', label: 'Avg Time on Page' },
    bounceRate:          { baseline: 0,   target: 65,  actual: 0,   unit: '%', label: 'Bounce Rate (max)' },
  },
  instagram: {
    adCtr:        { baseline: 1.3,  target: 1.5, actual: 1.3,  unit: '%', label: 'Ad CTR' },
    profileConv:  { baseline: 0.6,  target: 3,   actual: 0.6,  unit: '%', label: 'Profile Conversion' },
    followConv:   { baseline: 0.03, target: 0.5, actual: 0.03, unit: '%', label: 'Follow Conversion' },
  },
  pr: {
    placements: { baseline: 1, target: 3, actual: 1, unit: '', label: 'Real Placements' },
  },
  links: {
    naturalLinks:        { baseline: 0, target: 8, actual: 0, unit: '', label: 'Natural Links' },
    partnerLinks:        { baseline: 0, target: 2, actual: 0, unit: '', label: 'Partner Backlinks' },
    articlesDistributed: { baseline: 0, target: 3, actual: 0, unit: '', label: 'Articles Distributed (Medium etc.)' },
  },
  youtube: {
    episodesPublished: { baseline: 1, target: 3, actual: 1, unit: '', label: 'Episodes Published' },
    clipsViral:        { baseline: 0, target: 1, actual: 0, unit: '', label: 'Clips beyond followers' },
  },
  telegram: {
    targetedUsersPerMonth: { baseline: 0, target: 2000, actual: 0, unit: '', label: 'Targeted users / mo (parsing)' },
    nativePlacementsTested: { baseline: 0, target: 2, actual: 0, unit: '', label: 'Native placements tested' },
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// CHANNEL DIRECTIVES — short strategic summary per channel, quoting the PDF
// ─────────────────────────────────────────────────────────────────────────────
const DIRECTIVES_DEFAULT = {
  seo: {
    title: 'SEO', color: '#10B981',
    body: 'April is validation, not scaling. CTR fix is main priority — 1.6% means we show up but are not chosen. Lock 6 core pages: EMI, PSP, buy fintech, sell fintech, banking, crypto licenses. Track if linkbuilding moves pages into top 20–30. If impressions grow but CTR doesn\'t — the problem is messaging. If CTR improves but clicks stay low — the problem is ranking.',
  },
  linkedin: {
    title: 'LinkedIn', color: '#0A66C2',
    body: 'Most aligned channel — 34% visitor→follow already. Test controlled paid traffic to find who clicks AND stays. EU/UK primary, small US test. Audience: founders, investors, fintech operators in payments/banking/M&A. Posts that look like thoughts, not ads. No design-heavy visuals. Track every funnel stage — CTR 0.8–1.5%, avg time 1.5min+, bounce <65%, page→action 3–5%.',
  },
  instagram: {
    title: 'Instagram', color: '#E1306C',
    body: 'Currently buys attention but does not convert — 0.03% follow rate is almost zero. April: reactivating with new approach — rebuild before scale. Use as clip distribution for podcast.',
  },
  pr: {
    title: 'PR', color: '#7C3AED',
    body: 'Credibility layer, not traffic. Pitch context not platform. N5Deal appears INSIDE stories, not as the subject. Target 2–4 real placements in fintech/founder/M&A media (EU/UK focus). Angles: build vs buy, fintech M&A acceleration, cross-border banking friction, founder exit struggles.',
  },
  youtube: {
    title: 'YouTube + Podcast', color: '#FF0000',
    body: 'Three episodes ready. Per episode: clips Mon–Sat (3 unique + 3 adapted), full episode end of week, then PAUSE week 2 before next episode. Clips must work standalone — entry point, not promotion. Each clip delivers value from the episode without needing to know there\'s a full one behind it. Distribute to IG Reels and LI shorts.',
  },
  telegram: {
    title: 'Telegram', color: '#26A5E4',
    body: 'Deal-flow feed, not content channel. ONE channel — no noisy multi-feed split. Post format: asset+geo first line, 2–3 lines description, 1 line market context, direct CTA. Three growth levers: 1) parsing (core, 1k–3k targeted users/mo, controlled to avoid bans), 2) native paid placements in fintech/founder channels, 3) ecosystem integration — LinkedIn + website + outreach reference Telegram as deal access. Telegram is where listings become interaction.',
  },
  links: {
    title: 'Free Linkbuilding', color: '#059669',
    body: 'Indie Hackers, Product Hunt (ongoing updates), Hacker News (carefully — community reads for quality). Medium + Substack for republishing core articles. Reddit r/startups, r/Entrepreneur, r/fintech — answer questions, no promo. Partner links from legal firms / M&A advisors / fintech consultants — strongest long-term, doubles as BD. Guest contributions in niche blogs. The real question: does a founder/buyer trust this source?',
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// CURRENT STATE — baseline diagnosis from "Where We Are Now" section
// ─────────────────────────────────────────────────────────────────────────────
const CURRENT_STATE_DEFAULT = {
  asOf: 'end Q1 2026',
  channels: {
    seo: {
      label: 'SEO',
      color: '#10B981',
      metrics: [
        { label: 'Impressions',  value: '1,890' },
        { label: 'Clicks',       value: '31' },
        { label: 'CTR',          value: '1.6%' },
        { label: 'Budget spent', value: '~$3,000' },
      ],
      diagnosis: 'We are being seen, but not chosen yet. Rankings unstable, organic traffic low. SEO right now is building presence, not generating demand.',
    },
    traffic: {
      label: 'Traffic (GA4)',
      color: '#3F9B5C',
      metrics: [
        { label: 'Direct',         value: '81.6%' },
        { label: 'Organic Search', value: '6.6%' },
        { label: 'Social',         value: '7.4%' },
        { label: 'Referral',       value: '3.3%' },
      ],
      diagnosis: 'Most traffic comes from direct actions — outreach, social, manual entry. Traffic exists, but it is not structured by intent.',
    },
    instagram: {
      label: 'Instagram (paid test)',
      color: '#E1306C',
      metrics: [
        { label: 'Spent',           value: '~$200' },
        { label: 'Views',           value: '~25,000' },
        { label: 'Reach',           value: '~14,800' },
        { label: 'Link Clicks',     value: '339' },
        { label: 'Profile Visits',  value: '508' },
        { label: 'Follows',         value: '4' },
        { label: 'Ad CTR',          value: '1.3%' },
        { label: 'Follow Conv.',    value: '0.03%' },
      ],
      diagnosis: 'People see content, click, even check the profile — but don\'t continue. Buys attention, does not convert it into users. OK for now — we are reactivating IG.',
    },
    linkedin: {
      label: 'LinkedIn (organic)',
      color: '#0A66C2',
      metrics: [
        { label: 'Followers',      value: '710' },
        { label: 'New Followers',  value: '37' },
        { label: 'Page Views',     value: '207' },
        { label: 'Visitors',       value: '109' },
        { label: 'Visitor→Follow', value: '34%' },
      ],
      diagnosis: 'The most aligned channel. Growth organic, audience relevant, early signals of authority. Working but still early — audience not fully clean by geography yet.',
    },
    telegram: {
      label: 'Telegram',
      color: '#26A5E4',
      diagnosis: 'Already positioned correctly — structured deal-flow feed, not a content channel. Fast, clear, no noise. One of the strongest pieces we have.',
    },
  },
  gap: 'We generate attention, traffic, launch channels — but conversion is inconsistent, retention is weak, positioning is not fully unified, and traffic is not structured by intent. Attention does not turn into users, and users do not turn into deals.',
}

// ─────────────────────────────────────────────────────────────────────────────
// AUTHORITY LAYER — Q3/Q4 strategic direction
// ─────────────────────────────────────────────────────────────────────────────
const AUTHORITY_LAYER_DEFAULT = {
  coreShift: 'Q2 tests the system. Q3 builds the layer. Q4 proves it holds. From Q3 onward, content, PR, and events stop being separate workstreams — they become one system with one goal: authority that connects directly to deal flow.',
  positioning: 'Not a fintech media brand. Not an event company. The authority layer around one specific space: licensed fintech infrastructure, buyer/seller readiness, and how regulated fintech is actually built, acquired, and scaled in practice. Narrow by design — narrow positioning is a competitive advantage in a specialised market.',
  q3Events: [
    {
      id: 'build-vs-buy',
      name: 'Build vs Buy',
      month: 'July',
      role: 'Entry point — broadest relevant audience. Build vs buy vs partner is no longer theoretical — it\'s a time, cost, and regulatory decision with real consequences.',
      goals: [
        'Attract top-of-funnel relevant audience',
        'Test messaging at scale',
        'Identify who responds to infrastructure narratives vs product narratives',
      ],
    },
    {
      id: 'buyers-value',
      name: 'What Buyers Actually Value',
      month: 'August',
      role: 'Broad to specific. A license alone is not valuable — we make explicit what makes a regulated fintech asset attractive in a real transaction.',
      goals: [
        'Educate sellers on how to prepare',
        'Qualify buyers on what they\'re looking for',
        'Move platform conversations closer to real deal activity',
      ],
    },
    {
      id: 'cross-border',
      name: 'Cross-Border Scale',
      month: 'September',
      role: 'Connects infrastructure to growth. Expansion is not a geography decision — it\'s infrastructure, compliance, and partnerships.',
      goals: [
        'Connect infrastructure narrative with post-acquisition growth',
        'Prepare the audience for California',
        'Identify highest-intent participants before getting in the room with them',
      ],
    },
  ],
  california: {
    name: 'California — September',
    kind: 'curated offline',
    positioning: 'Not a large conference. Not a mass event. A curated room of relevant operators, buyers, partners, and advisors — people either already in a deal conversation or six months away from one. Three online events are the qualification system; California is where those conversations happen in person. Competing on relevance, not visibility.',
    goals: [
      'Strengthen positioning as the platform for regulated fintech transactions',
      'Build relationships that convert into deals and partnerships',
      'Generate the strongest PR and content moment of the year',
    ],
  },
  reportSystem: {
    intro: 'One core report. Four parts. Released progressively, then combined into the main authority asset of the year. Each part is published standalone before the full report drops — feeds the paired event, generates PR angles, creates landing content.',
    parts: [
      { n: 1, title: 'Infrastructure vs Hype',     desc: "What's real in regulated fintech right now." },
      { n: 2, title: 'What Buyers Actually Value', desc: 'Inside view on licensed asset transactions — what moves price.' },
      { n: 3, title: 'Cross-Border Scale Logic',   desc: 'How expansion actually works in practice.' },
      { n: 4, title: 'Exit Readiness',             desc: 'What founders need in place before they can sell.' },
    ],
  },
  measurement: [
    'Quality and relevance of event participants',
    'Meaningful follow-ups after each event',
    'Report downloads from the right audience segments',
    'Inbound deal inquiries attributed to content or PR',
    'Platform registrations from organic and semi-organic sources',
    'Advisors, media, and operators referencing N5Deal unprompted',
    'California: how many real deal conversations started in that room',
  ],
}

// ─────────────────────────────────────────────────────────────────────────────
// Merge helpers — keep user edits, only fill gaps.
// ─────────────────────────────────────────────────────────────────────────────
type BudgetMap = Record<string, Record<string, BudgetRow>>

function mergeBudget(existing: BudgetMap | null | undefined, defaults: BudgetMap): { merged: BudgetMap; touched: number } {
  const out: BudgetMap = JSON.parse(JSON.stringify(existing ?? {}))
  let touched = 0
  for (const [month, channels] of Object.entries(defaults)) {
    if (!out[month]) { out[month] = {}; }
    for (const [ch, row] of Object.entries(channels)) {
      if (!out[month][ch]) {
        // First time — install verbatim (preserves any default actual we set).
        out[month][ch] = { ...row }
        touched++
      } else {
        // Row already present — update plan / purpose only if they were never set.
        if (out[month][ch].min == null) out[month][ch].min = row.min
        if (out[month][ch].max == null) out[month][ch].max = row.max
        if (!out[month][ch].purpose) out[month][ch].purpose = row.purpose
      }
    }
  }
  return { merged: out, touched }
}

type GoalsMap = typeof GOALS_DEFAULT
function mergeGoals(existing: any, defaults: any): { merged: any; touched: number } {
  const out = JSON.parse(JSON.stringify(existing ?? {}))
  let touched = 0
  for (const [cat, metrics] of Object.entries<any>(defaults)) {
    if (!out[cat]) { out[cat] = {} }
    for (const [m, g] of Object.entries<any>(metrics)) {
      if (!out[cat][m]) {
        out[cat][m] = { ...g }
        touched++
      } else {
        if (!('label' in out[cat][m])) out[cat][m].label = g.label
        if (!('unit' in out[cat][m])) out[cat][m].unit = g.unit
        if (out[cat][m].target == null) out[cat][m].target = g.target
        if (out[cat][m].baseline == null) out[cat][m].baseline = g.baseline
      }
    }
  }
  return { merged: out, touched }
}

async function main() {
  const project = await prisma.project.findUnique({ where: { id: PROJECT_ID } })
  if (!project) throw new Error(`Project ${PROJECT_ID} not found`)

  const existing = await prisma.marketingStrategy.findUnique({ where: { projectId: PROJECT_ID } })

  const { merged: budget, touched: budgetTouched } = mergeBudget(existing?.budget as BudgetMap | null, BUDGET_DEFAULTS)
  const { merged: goals, touched: goalsTouched } = mergeGoals(existing?.goals, GOALS_DEFAULT)

  // Directives / current state / authority layer — only set if entirely empty.
  const directives = existing?.channelDirectives ?? DIRECTIVES_DEFAULT
  const currentState = existing?.currentState ?? CURRENT_STATE_DEFAULT
  const authorityLayer = existing?.authorityLayer ?? AUTHORITY_LAYER_DEFAULT

  const directivesWritten = !existing?.channelDirectives
  const currentStateWritten = !existing?.currentState
  const authorityLayerWritten = !existing?.authorityLayer

  await prisma.marketingStrategy.upsert({
    where: { projectId: PROJECT_ID },
    create: {
      projectId: PROJECT_ID,
      activeBudgetMonth: 'april',
      budget,
      goals,
      channelDirectives: directives,
      currentState,
      authorityLayer,
    },
    update: {
      budget,
      goals,
      channelDirectives: directives as any,
      currentState: currentState as any,
      authorityLayer: authorityLayer as any,
    },
  })

  console.log(`\nMarketing Strategy — Q2/Q4 doc imported:`)
  console.log(`  Budget rows added:       ${budgetTouched} (existing actuals preserved)`)
  console.log(`  Goal rows added:         ${goalsTouched} (existing actuals preserved)`)
  console.log(`  Directives written:      ${directivesWritten ? 'yes (first time)' : 'no (already set)'}`)
  console.log(`  Current State written:   ${currentStateWritten ? 'yes (first time)' : 'no (already set)'}`)
  console.log(`  Authority Layer written: ${authorityLayerWritten ? 'yes (first time)' : 'no (already set)'}`)
  console.log('')
}

main()
  .catch((e) => { console.error('ERROR:', e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
