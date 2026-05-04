import { syncObsidianVault } from '../lib/obsidian-sync'
import { embeddingsAvailable } from '../lib/embeddings'
import { prisma } from '../lib/db'

const PROJECT_ID = process.env.PROJECT_ID || 'seed-project-n5deal'
const VAULT_PATH = process.env.VAULT_PATH || '/Users/andriykrechkivsky/Documents/MyVault'

async function main() {
  if (!embeddingsAvailable()) {
    throw new Error('embeddingsAvailable()=false — check Ollama / EMBEDDINGS_PROVIDER')
  }

  await prisma.project.update({
    where: { id: PROJECT_ID },
    data: { obsidianVaultPath: VAULT_PATH },
  })
  console.log(`Set obsidianVaultPath=${VAULT_PATH} on project=${PROJECT_ID}`)

  console.log('Running syncObsidianVault…')
  const t0 = Date.now()
  const result = await syncObsidianVault(PROJECT_ID, VAULT_PATH)
  const sec = ((Date.now() - t0) / 1000).toFixed(1)
  console.log(`Sync done in ${sec}s:`, result)
}

main()
  .catch((err) => {
    console.error('Sync failed:', err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
