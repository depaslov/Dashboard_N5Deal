import fs from 'fs/promises'
import path from 'path'
import { buildBriefPrompt } from '../lib/content-brief'
import { obsidianScope } from '../lib/obsidian-sync'
import { loadVectorStoreForScopes } from '../lib/embedding-store'
import { prisma } from '../lib/db'

const VAULT_RAG_MAX_CHARS = 4500
const VAULT_RAG_MIN_SCORE = 0.55

const PROJECT_ID = 'seed-project-n5deal'
const VAULT_PATH = '/Users/andriykrechkivsky/Documents/MyVault'

// Rough heuristic: GPT/Claude tokenize ~4 chars/token for EN, ~2 for UK Cyrillic.
// Mixed corpus → use 3.5 as a conservative blended ratio.
const CHARS_PER_TOKEN = 3.5
const tok = (input: string | number) => {
  const len = typeof input === 'string' ? input.length : input
  return Math.round(len / CHARS_PER_TOKEN)
}

async function measureCurrentPrompt() {
  const project = await prisma.project.findUnique({
    where: { id: PROJECT_ID },
    include: { icps: true, redFlagWords: true, internalLinks: true },
  })
  if (!project) throw new Error('No project')
  const icp = project.icps[0]
  const icpContext = `\n- Persona: ${icp.name}\n- Industry: ${icp.industry}\n- Company size: ${icp.companySize}\n- Pain points: ${icp.painPoints.join('; ')}\n- Goals: ${icp.goals.join('; ')}\n- Budget: ${icp.budgetRange}\n- Demographics: ${icp.demographics}\n- Decision process: ${icp.decisionProcess}`
  const mergedRedFlags = project.redFlagWords.map((r) => ({
    word: r.word,
    severity: r.severity as 'warn' | 'block',
    reason: r.reason ?? undefined,
  }))
  const mergedInternalLinks = project.internalLinks.map((l) => ({
    url: l.url,
    anchor: l.anchor,
    anchorAlts: l.anchorAlts,
    context: l.context ?? undefined,
    priority: l.priority as 'must' | 'nice',
  }))
  const { system, user } = buildBriefPrompt({
    contentType: 'article',
    topic: 'MiCA compliance for crypto founders',
    targetAudience: 'Crypto Founder (VASP)',
    keyMessages: 'Speed up regulatory readiness with ready-made licenses',
    brief: {
      pageUrl: '',
      icpId: icp.id,
      language: 'uk',
      tone: 'Conversational-Professional',
      format: 'Informative, Q&A friendly',
      goal: 'Reader understands MiCA timeline and license options',
      placement: '',
      wordCountMin: 1000,
      wordCountMax: 1400,
      uniqueness: 90,
      useH2: true,
      useH3: true,
      useLists: true,
      allowHeadingReorder: true,
      notes: '',
      structure: [
        { heading: 'What is MiCA', subtopics: ['Timeline', 'Scope'] },
        { heading: 'License options', subtopics: ['VASP', 'EMI', 'PI'] },
        { heading: 'Buying vs building', subtopics: [] },
      ],
      mainKeywords: [{ term: 'MiCA license', minCount: 3 }, { term: 'crypto compliance', minCount: 2 }],
      lsiKeywords: ['VASP', 'EMI license', 'crypto regulation EU'],
      redFlags: [],
      internalLinks: [],
    },
    icpContext,
    mergedRedFlags,
    mergedInternalLinks,
    documentContext: '',
  })
  return { system, user }
}

async function vaultTotalSize() {
  let total = 0
  let files = 0
  async function walk(dir: string) {
    const entries = await fs.readdir(dir, { withFileTypes: true })
    for (const e of entries) {
      if (e.name.startsWith('.')) continue
      const p = path.join(dir, e.name)
      if (e.isDirectory()) await walk(p)
      else if (e.name.endsWith('.md')) {
        const c = await fs.readFile(p, 'utf-8')
        total += c.length
        files++
      }
    }
  }
  await walk(VAULT_PATH)
  return { totalChars: total, files }
}

async function ragRetrievalSize(query: string, k: number) {
  const store = await loadVectorStoreForScopes([obsidianScope(PROJECT_ID)])
  const results = await store.similaritySearchWithScore(query, k)
  const text = results.map(([d]) => d.pageContent).join('\n\n---\n\n')
  return { chars: text.length, hits: results.length }
}

async function buildKbContextSized(query: string, k = 6) {
  const store = await loadVectorStoreForScopes([obsidianScope('seed-project-n5deal')])
  const hits = await store.similaritySearchWithScore(query, k)
  const parts: string[] = []
  let total = 0
  const sources = new Set<string>()
  for (const [doc, score] of hits) {
    if (score < VAULT_RAG_MIN_SCORE) continue
    const block = `### From: ${doc.metadata?.key}\n${doc.pageContent.trim()}`
    if (total + block.length > VAULT_RAG_MAX_CHARS) break
    parts.push(block)
    sources.add(String(doc.metadata?.key))
    total += block.length + 6
  }
  return { text: parts.join('\n\n---\n\n'), sources: Array.from(sources), chars: total }
}

async function main() {
  const { system, user } = await measureCurrentPrompt()
  const vault = await vaultTotalSize()
  const ragK4 = await ragRetrievalSize('MiCA compliance crypto VASP license', 4)
  const ragK8 = await ragRetrievalSize('MiCA compliance crypto VASP license', 8)
  const kbReal = await buildKbContextSized(
    'MiCA compliance crypto VASP license MiCA license crypto compliance VASP EMI license crypto regulation EU',
    6,
  )

  const sysT = tok(system)
  const userT = tok(user)
  const baseTotal = sysT + userT

  console.log('\n' + '='.repeat(80))
  console.log('  TOKEN USAGE — реальні виміри (ratio: 3.5 chars/token, EN+UK mix)')
  console.log('='.repeat(80))

  console.log('\n=== A. ПОТОЧНИЙ продакшен-промпт (без Obsidian) ===')
  console.log(`  System prompt:     ${system.length.toString().padStart(7)} chars  ≈ ${sysT.toString().padStart(5)} tokens`)
  console.log(`  User prompt:       ${user.length.toString().padStart(7)} chars  ≈ ${userT.toString().padStart(5)} tokens`)
  console.log(`  ─ Total input:     ${(system.length + user.length).toString().padStart(7)} chars  ≈ ${baseTotal.toString().padStart(5)} tokens`)

  console.log(`\n=== B. ВЕСЬ vault як контекст (наївний підхід) ===`)
  console.log(`  ${vault.files} files, ${vault.totalChars} chars  ≈ ${tok(vault.totalChars).toString().padStart(5)} tokens (додатково)`)
  console.log(`  Total if we stuff everything: ≈ ${(baseTotal + tok(vault.totalChars)).toString().padStart(5)} tokens`)

  console.log(`\n=== C. RAG-retrieval (top-4 з Obsidian) ===`)
  console.log(`  ${ragK4.hits} chunks, ${ragK4.chars} chars  ≈ ${tok(ragK4.chars).toString().padStart(5)} tokens (додатково)`)
  console.log(`  Total with RAG-4: ≈ ${(baseTotal + tok(ragK4.chars)).toString().padStart(5)} tokens`)

  console.log(`\n=== D. RAG-retrieval (top-8 з Obsidian) ===`)
  console.log(`  ${ragK8.hits} chunks, ${ragK8.chars} chars  ≈ ${tok(ragK8.chars).toString().padStart(5)} tokens (додатково)`)
  console.log(`  Total with RAG-8: ≈ ${(baseTotal + tok(ragK8.chars)).toString().padStart(5)} tokens`)

  console.log('\n=== ПОРІВНЯННЯ ЕКОНОМІЇ (vs наївний "stuff everything") ===')
  const naive = baseTotal + tok(vault.totalChars)
  const ragTotal = baseTotal + tok(ragK4.chars)
  const saved = naive - ragTotal
  const pct = ((saved / naive) * 100).toFixed(1)
  console.log(`  Naive (вся vault):  ${naive} tokens`)
  console.log(`  RAG (top-4):        ${ragTotal} tokens`)
  console.log(`  Економія:           ${saved} tokens (${pct}%) — ЯКЩО RAG увімкнути в /api/content/generate`)

  console.log('\n=== РЕАЛЬНИЙ СТАН (після інтеграції RAG у /api/content/generate) ===')
  console.log(`  Baseline prompt (без vault):              ${baseTotal} tokens`)
  console.log(`  KB context sized for production:          ${kbReal.chars} chars  ≈ ${tok(kbReal.chars)} tokens`)
  console.log(`  Sources used:                             ${kbReal.sources.length}`)
  for (const s of kbReal.sources) console.log(`    - ${s}`)
  console.log(`  Total prompt with RAG (real):             ≈ ${baseTotal + tok(kbReal.chars)} tokens`)
  console.log(`  Δ vs naive vault stuffing:                -${(baseTotal + tok(vault.totalChars)) - (baseTotal + tok(kbReal.chars))} tokens (${(((baseTotal + tok(vault.totalChars)) - (baseTotal + tok(kbReal.chars))) / (baseTotal + tok(vault.totalChars)) * 100).toFixed(1)}% saved vs stuffing all ${vault.files} files)`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
