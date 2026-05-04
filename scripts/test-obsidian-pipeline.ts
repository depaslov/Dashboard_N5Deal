import fs from 'fs/promises'
import path from 'path'
import { syncObsidianVault, obsidianScope } from '../lib/obsidian-sync'
import { loadVectorStoreForScopes } from '../lib/embedding-store'
import { exportProjectToObsidianVault } from '../lib/obsidian-export'
import { prisma } from '../lib/db'

const PROJECT_ID = 'seed-project-n5deal'
const VAULT_PATH = '/Users/andriykrechkivsky/Documents/MyVault'
const SCOPE = obsidianScope(PROJECT_ID)

function banner(msg: string) {
  console.log('\n' + '='.repeat(70))
  console.log(msg)
  console.log('='.repeat(70))
}

async function chunkCount(): Promise<number> {
  return prisma.embeddingChunk.count({ where: { scope: SCOPE } })
}

async function main() {
  banner('TEST 1 — Similarity search (retrieval correctness)')
  const store = await loadVectorStoreForScopes([SCOPE])
  const queries = [
    'MiCA deadline crypto VASP compliance',
    'fintech founder ICP profile pain points',
    'Ukrainian red flag stop words AI cliche',
    'internal link buy a licensed business',
  ]
  for (const q of queries) {
    const results = await store.similaritySearchWithScore(q, 3)
    console.log(`\nQuery: "${q}"`)
    for (const [doc, score] of results) {
      console.log(`  [${score.toFixed(3)}] ${doc.metadata.key} (chunk ${doc.metadata.chunkIndex})`)
    }
  }

  banner('TEST 2 — Idempotent re-sync (no changes)')
  const before2 = await chunkCount()
  const r2 = await syncObsidianVault(PROJECT_ID, VAULT_PATH)
  console.log('Result:', r2, '| DB chunks before:', before2, 'after:', await chunkCount())
  if (r2.embedded === 0 && r2.deleted === 0 && r2.reused > 0) {
    console.log('PASS — incremental cache works (nothing re-embedded)')
  } else {
    console.log('FAIL — expected embedded=0/deleted=0/reused>0')
  }

  banner('TEST 3 — Modify a file, re-sync')
  const targetFile = path.join(VAULT_PATH, 'n5deal-project/ICPs/Fintech Founder.md')
  const original = await fs.readFile(targetFile, 'utf-8')
  await fs.writeFile(targetFile, original + '\n\n## Test addition\n\nThis is a test paragraph to trigger re-embed.\n')
  const r3 = await syncObsidianVault(PROJECT_ID, VAULT_PATH)
  console.log('Result:', r3)
  await fs.writeFile(targetFile, original)
  if (r3.embedded > 0 && r3.reused > 0) {
    console.log('PASS — only the modified file was re-embedded')
  } else {
    console.log('FAIL — expected embedded>0 AND reused>0')
  }

  banner('TEST 4 — Delete a file, re-sync (purge)')
  const delFile = path.join(VAULT_PATH, 'n5deal-project/Red Flags/delve.md')
  await fs.unlink(delFile)
  const before4 = await chunkCount()
  const r4 = await syncObsidianVault(PROJECT_ID, VAULT_PATH)
  const after4 = await chunkCount()
  console.log('Result:', r4, '| DB chunks before:', before4, 'after:', after4)
  if (r4.deleted > 0 && after4 < before4) {
    console.log('PASS — deleted file purged from DB')
  } else {
    console.log('FAIL — expected deleted>0 and DB count to drop')
  }

  banner('TEST 5 — Restore vault & final sync (return to clean state)')
  const restored = await exportProjectToObsidianVault(PROJECT_ID, VAULT_PATH)
  console.log(`Restored ${restored.createdFiles.length} files`)
  const r5 = await syncObsidianVault(PROJECT_ID, VAULT_PATH)
  console.log('Final sync:', r5, '| DB chunks:', await chunkCount())

  banner('SUMMARY')
  console.log(`Final DB state: ${await chunkCount()} chunks under scope ${SCOPE}`)
}

main()
  .catch((err) => {
    console.error('Test failed:', err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
