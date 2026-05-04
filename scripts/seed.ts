import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  const adminPassword = await bcrypt.hash('johndoe123', 10)
  const admin = await prisma.user.upsert({
    where: { email: 'john@doe.com' },
    update: {},
    create: {
      email: 'john@doe.com',
      passwordHash: adminPassword,
      name: 'John Doe',
      role: 'admin',
    },
  })

  const project = await prisma.project.upsert({
    where: { id: 'seed-project-n5deal' },
    update: {},
    create: {
      id: 'seed-project-n5deal',
      name: 'N5Deal Marketing',
      companyName: 'N5Deal',
      description: 'M&A platform for regulated financial assets (EMI, PI, MSB, VASP, crypto, fintech). Content engine for 7 ICPs across 8 SEO clusters.',
      ownerId: admin.id,
    },
  })

  await prisma.projectMember.upsert({
    where: { projectId_userId: { projectId: project.id, userId: admin.id } },
    update: {},
    create: {
      projectId: project.id,
      userId: admin.id,
      role: 'admin',
    },
  })

  // Sample ICPs based on N5Deal's actual ICP matrix
  const icps = [
    {
      id: 'seed-icp-fintech-founder',
      name: 'Fintech Founder',
      industry: 'Fintech / Financial Services',
      companySize: 'Seed – Series B (5–50 employees)',
      painPoints: [
        'Slow and expensive path to obtaining a financial license',
        'Lack of compliance expertise in-house',
        'Time-to-market pressure from investors',
        'Uncertainty around FCA / MiCA regulatory requirements',
      ],
      goals: [
        'Launch a licensed fintech product in under 6 months',
        'Acquire ready-made EMI / PI / MSB assets',
        'Secure predictable regulatory roadmap',
      ],
      demographics: 'Founders and C-level, 28–45, EU / UK / CIS, English-speaking, technical background',
      budgetRange: '€150K – €2M',
      decisionProcess: 'Founder-led; legal + compliance advisor involvement; 2–8 week decision cycle',
    },
    {
      id: 'seed-icp-payment-startup',
      name: 'Payment Startup',
      industry: 'Payments / Digital Wallets',
      companySize: '10–100 employees',
      painPoints: [
        'Long PI / EMI licensing timeline',
        'Acquiring bank partnerships before license is granted',
        'Building AML/KYC stack while shipping product',
      ],
      goals: [
        'Go live with a payments product in a regulated jurisdiction',
        'Scale cross-border flows post-launch',
        'Upgrade from PI to EMI when volume justifies',
      ],
      demographics: 'COO / Head of Compliance / CEO, 30–50, EU hubs (Lithuania, Ireland, Malta, Cyprus)',
      budgetRange: '€300K – €1.5M',
      decisionProcess: 'Committee-based; CEO + COO + legal; 3–6 week cycle',
    },
    {
      id: 'seed-icp-crypto-founder',
      name: 'Crypto Founder (VASP)',
      industry: 'Crypto / Web3',
      companySize: '5–40 employees',
      painPoints: [
        'MiCA compliance deadlines squeezing operations',
        'VASP registration varying wildly by jurisdiction',
        'Banking partnerships hard to secure for crypto',
      ],
      goals: [
        'Obtain a VASP registration in a crypto-friendly EU country',
        'Be MiCA-ready before the deadline',
        'Acquire an existing VASP to save 6+ months',
      ],
      demographics: 'Founders and CTOs, 25–40, global, crypto-native',
      budgetRange: '€80K – €800K',
      decisionProcess: 'Founder + legal counsel; fast, 2–4 week cycle',
    },
    {
      id: 'seed-icp-investor-fund',
      name: 'Investor / Fund',
      industry: 'Venture Capital / Private Equity',
      companySize: '5–30 investment professionals',
      painPoints: [
        'Limited pipeline of licensed fintech targets',
        'Due diligence on regulatory standing is opaque',
        'Difficulty exiting portfolio companies with regulatory debt',
      ],
      goals: [
        'Source pre-vetted, licensed fintech acquisition targets',
        'De-risk deals via transparent regulatory history',
        'Support portfolio companies with licensing upgrades',
      ],
      demographics: 'Partners / Principals, 35–55, London / Zurich / Luxembourg',
      budgetRange: '€5M – €50M per deal',
      decisionProcess: 'Investment committee; 6–12 week cycle',
    },
  ]

  for (const icp of icps) {
    await prisma.iCP.upsert({
      where: { id: icp.id },
      update: {},
      create: {
        ...icp,
        projectId: project.id,
      },
    })
  }

  // Sample generated content
  const contents = [
    {
      id: 'seed-content-1',
      contentType: 'linkedin',
      topic: 'Why ready-made PI licenses save 6 months of regulatory friction',
      targetAudience: 'Payment Startup founders',
      keyMessages: 'Time-to-market, regulatory certainty, capital efficiency',
      tone: 'Expert, tech, B2B',
      generatedBrief: '## LinkedIn Post Brief\n\n**Hook:** "Most payment startups burn 8 months on PI licensing. Here\'s how the smart ones cut that in half."\n\n**Body:**\n- Opening pain point: the real cost of a slow license is missed market timing\n- Data: typical greenfield PI = 6–12 months; acquisition = 4–8 weeks regulatory handover\n- Three questions to ask before buying a ready-made asset\n- Soft CTA to /start-buying\n\n**Hashtags:** #FintechBuilder #n5deal\n**Forbidden:** #Banking #Investment #FinancialServices\n**Compliance:** Avoid "рекомендуємо", "консультуємо". Use "згідно з загальнодоступною інформацією".',
    },
    {
      id: 'seed-content-2',
      contentType: 'article',
      topic: 'MiCA deadline survival guide for crypto founders',
      targetAudience: 'Crypto Founders (VASP ICP)',
      keyMessages: 'MiCA compliance checklist, jurisdictional options, acquisition as shortcut',
      tone: 'Informational, authoritative, B2B',
      generatedBrief: '## Article Brief\n\n**Title:** MiCA Deadline Survival Guide: A Fintech Builder\'s View\n\n**Target keyword:** mica compliance checklist\n**Cluster:** MICA / Crypto\n\n**Outline:**\n1. What MiCA changes for existing crypto operators (500 words)\n2. Jurisdictional comparison: Lithuania, Malta, Cyprus, Ireland (700 words)\n3. Build vs. buy — regulatory timeline math (600 words)\n4. Due diligence checklist for VASP acquisitions (500 words)\n5. CTA: explore licensed VASP assets on n5deal.com/start-buying\n\n**Word count:** 2,300–2,800\n**Internal links:** /vasp-license, /mica-faq\n**Compliance:** information-intermediary tone only; no advice language.',
    },
    {
      id: 'seed-content-3',
      contentType: 'telegram',
      topic: 'Weekly fintech regulation digest',
      targetAudience: 'Fintech Founders, Compliance Officers',
      keyMessages: 'Regulatory updates, EMI market moves, jurisdictional scan',
      tone: 'Short, tech, news-style',
      generatedBrief: '## Telegram Post Brief\n\n**Format:** 5 bullet digest + 1 link\n**Length:** ≤ 800 characters\n\n**Structure:**\n- 🇱🇹 Lithuanian CB EMI stance update\n- 🇨�\u007f Cyprus MSB applications — processing time Δ\n- 🇬🇧 FCA temporary permissions regime note\n- 🇪🇺 MiCA countdown (weeks left)\n- 📊 Market scan: 3 licensed assets in play\n\n**CTA:** "See our full weekly scan →" link to n5deal.com/marketplace\n**Compliance:** descriptive only. No "рекомендуємо", no guarantees.',
    },
  ]

  for (const content of contents) {
    await prisma.generatedContent.upsert({
      where: { id: content.id },
      update: {},
      create: {
        ...content,
        projectId: project.id,
        createdById: admin.id,
      },
    })
  }

  // --- Red Flag Dictionary: seed default AI-cliches, compliance traps, N5Deal brand rules ---
  const redFlags: Array<{
    word: string
    category: string
    severity?: string
    language?: string
    reason?: string
  }> = [
    // --- AI cliches (English) ---
    { word: 'delve', category: 'ai', language: 'en', reason: 'Classic AI tell-tale verb' },
    { word: 'delving', category: 'ai', language: 'en', reason: 'Classic AI tell-tale verb' },
    { word: 'tapestry', category: 'ai', language: 'en', reason: 'Overused AI metaphor' },
    { word: 'realm', category: 'ai', language: 'en', reason: 'Overused AI word' },
    { word: 'landscape', category: 'ai', language: 'en', reason: 'Overused AI word (in business context)' },
    { word: 'in today\u2019s fast-paced world', category: 'ai', language: 'en', reason: 'AI opener cliche' },
    { word: 'in the ever-evolving', category: 'ai', language: 'en', reason: 'AI opener cliche' },
    { word: 'navigating the complexities', category: 'ai', language: 'en', reason: 'AI cliche' },
    { word: 'leverage', category: 'ai', language: 'en', reason: 'Business-speak AI cliche' },
    { word: 'leveraging', category: 'ai', language: 'en', reason: 'Business-speak AI cliche' },
    { word: 'unleash', category: 'ai', language: 'en', reason: 'AI hype verb' },
    { word: 'unlock', category: 'ai', language: 'en', reason: 'AI hype verb (context-dependent)' },
    { word: 'harness', category: 'ai', language: 'en', reason: 'AI cliche' },
    { word: 'furthermore', category: 'ai', language: 'en', reason: 'Stiff AI connector' },
    { word: 'moreover', category: 'ai', language: 'en', reason: 'Stiff AI connector' },
    { word: 'in conclusion', category: 'ai', language: 'en', reason: 'AI closer cliche' },
    { word: 'it is important to note', category: 'ai', language: 'en', reason: 'Hedgy AI phrase' },
    { word: 'seamlessly', category: 'ai', language: 'en', reason: 'AI cliche' },
    { word: 'cutting-edge', category: 'ai', language: 'en', reason: 'Hype cliche' },
    { word: 'robust', category: 'ai', language: 'en', reason: 'Overused AI adjective' },
    { word: 'game-changer', category: 'ai', language: 'en', reason: 'Hype cliche' },
    { word: 'revolutionize', category: 'ai', language: 'en', reason: 'Hype verb' },
    { word: 'revolutionary', category: 'ai', language: 'en', reason: 'Hype adjective' },
    { word: 'paradigm shift', category: 'ai', language: 'en', reason: 'Consultantese cliche' },
    { word: 'synergy', category: 'ai', language: 'en', reason: 'Corporate cliche' },
    { word: 'myriad', category: 'ai', language: 'en', reason: 'Overused AI word' },
    { word: 'plethora', category: 'ai', language: 'en', reason: 'Overused AI word' },

    // --- AI cliches (Ukrainian) ---
    { word: 'у сучасному світі', category: 'ai', language: 'uk', reason: 'AI opener cliche' },
    { word: 'в еру цифровізації', category: 'ai', language: 'uk', reason: 'AI opener cliche' },
    { word: 'в еру технологій', category: 'ai', language: 'uk', reason: 'AI opener cliche' },
    { word: 'варто зазначити', category: 'ai', language: 'uk', reason: 'Stiff AI phrase' },
    { word: 'слід зауважити', category: 'ai', language: 'uk', reason: 'Stiff AI phrase' },
    { word: 'не секрет, що', category: 'ai', language: 'uk', reason: 'AI filler' },
    { word: 'у світі, що постійно змінюється', category: 'ai', language: 'uk', reason: 'AI cliche' },
    { word: 'відкриває нові горизонти', category: 'ai', language: 'uk', reason: 'AI cliche' },
    { word: 'безмежні можливості', category: 'ai', language: 'uk', reason: 'Hype cliche' },
    { word: 'революційний', category: 'ai', language: 'uk', reason: 'Hype adjective' },
    { word: 'інноваційний', category: 'ai', language: 'uk', reason: 'Overused hype adjective' },

    // --- N5Deal compliance traps (per brief: "non-advisory" positioning) ---
    { word: 'рекомендуємо', category: 'compliance', language: 'uk', severity: 'block', reason: 'N5Deal is an information intermediary, not an advisor' },
    { word: 'радимо', category: 'compliance', language: 'uk', severity: 'block', reason: 'Advisory language \u2014 not allowed' },
    { word: 'консультуємо', category: 'compliance', language: 'uk', severity: 'block', reason: 'Advisory language \u2014 not allowed' },
    { word: 'наша порада', category: 'compliance', language: 'uk', severity: 'block', reason: 'Advisory language' },
    { word: 'we recommend', category: 'compliance', language: 'en', severity: 'block', reason: 'Advisory language \u2014 not allowed' },
    { word: 'we advise', category: 'compliance', language: 'en', severity: 'block', reason: 'Advisory language \u2014 not allowed' },
    { word: 'you should', category: 'compliance', language: 'en', severity: 'warn', reason: 'Advisory phrasing \u2014 prefer descriptive' },
    { word: 'guaranteed returns', category: 'compliance', language: 'en', severity: 'block', reason: 'Regulatory risk \u2014 no guarantees' },
    { word: 'risk-free', category: 'compliance', language: 'en', severity: 'block', reason: 'Regulatory risk \u2014 never claim' },
    { word: 'гарантовано', category: 'compliance', language: 'uk', severity: 'block', reason: 'Regulatory risk \u2014 no guarantees' },
  ]

  for (const rf of redFlags) {
    const category = rf.category
    const severity = rf.severity ?? 'warn'
    const language = rf.language ?? 'any'
    const reason = rf.reason ?? null
    await prisma.redFlagWord.upsert({
      where: {
        projectId_word_language: {
          projectId: project.id,
          word: rf.word,
          language,
        },
      },
      update: { category, severity, reason },
      create: {
        projectId: project.id,
        word: rf.word,
        category,
        severity,
        language,
        reason,
      },
    })
  }

  console.log(`Red flag dictionary: ${redFlags.length} entries`)

  // ---------- Internal Links (N5Deal internal linking library) ----------
  const internalLinks: Array<{
    url: string
    anchor: string
    anchorAlts: string[]
    context: string | null
    category: string | null
    priority: string
  }> = [
    {
      url: 'https://n5deal.com/buyer',
      anchor: 'buy a licensed business',
      anchorAlts: ['for buyers', 'acquire a company', 'buy-side flow', 'buyer guide'],
      context: 'When talking about the buy-side flow, acquiring a licensed business, how buyers work with N5Deal, or deal process from the buyer perspective.',
      category: 'product',
      priority: 'must',
    },
    {
      url: 'https://n5deal.com/marketplace',
      anchor: 'licensed business marketplace',
      anchorAlts: ['fintech marketplace', 'browse listings', 'marketplace of licensed companies', 'active listings'],
      context: 'When referring to the catalog of available companies, listings, or inventory of licensed businesses for sale.',
      category: 'product',
      priority: 'must',
    },
    {
      url: 'https://n5deal.com/start-buying',
      anchor: 'start your acquisition',
      anchorAlts: ['begin the buying process', 'get started as a buyer', 'onboard as buyer'],
      context: 'Call-to-action for buyers who want to start searching, verify identity, or begin the buy-side journey.',
      category: 'cta',
      priority: 'nice',
    },
    {
      url: 'https://n5deal.com/vasp-license',
      anchor: 'VASP license options',
      anchorAlts: ['buy a VASP license', 'crypto-license companies', 'VASP-licensed businesses'],
      context: 'When discussing VASP (Virtual Asset Service Provider) licenses, crypto-licensed entities, or crypto compliance jurisdictions.',
      category: 'vertical',
      priority: 'nice',
    },
    {
      url: 'https://n5deal.com/mica-faq',
      anchor: 'MiCA compliance guide',
      anchorAlts: ['MiCA FAQ', 'MiCA regulation overview', 'EU crypto rules'],
      context: 'When explaining MiCA (Markets in Crypto-Assets) regulation, EU crypto framework, or CASP/VASP transition.',
      category: 'resource',
      priority: 'nice',
    },
    {
      url: 'https://n5deal.com/seller',
      anchor: 'sell your licensed company',
      anchorAlts: ['for sellers', 'list your business', 'sell-side flow', 'exit your business'],
      context: 'When discussing the sell-side flow, how owners list a company for sale, or exit options for current licence holders.',
      category: 'product',
      priority: 'nice',
    },
    {
      url: 'https://n5deal.com/faq',
      anchor: 'frequently asked questions',
      anchorAlts: ['FAQ', 'help centre', 'common questions'],
      context: 'Generic help / FAQ reference — use only when the article touches multiple topics and a general FAQ is the natural link.',
      category: 'resource',
      priority: 'nice',
    },
  ]

  for (const link of internalLinks) {
    await prisma.internalLink.upsert({
      where: {
        projectId_url: {
          projectId: project.id,
          url: link.url,
        },
      },
      update: {
        anchor: link.anchor,
        anchorAlts: link.anchorAlts,
        context: link.context,
        category: link.category,
        priority: link.priority,
      },
      create: {
        projectId: project.id,
        url: link.url,
        anchor: link.anchor,
        anchorAlts: link.anchorAlts,
        context: link.context,
        category: link.category,
        priority: link.priority,
        isActive: true,
      },
    })
  }

  console.log(`Internal links: ${internalLinks.length} entries`)

  console.log('Seeding complete.')
  console.log(`Admin user: ${admin.email}`)
  console.log(`Project: ${project.name} (${project.id})`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
