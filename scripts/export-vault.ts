import { exportProjectToObsidianVault } from '../lib/obsidian-export'
import { prisma } from '../lib/db'

const PROJECT_ID = process.env.PROJECT_ID || 'seed-project-n5deal'
const VAULT_PATH = process.env.VAULT_PATH || '/Users/andriykrechkivsky/Documents/MyVault'

async function main() {
  console.log(`Exporting project=${PROJECT_ID} → vault=${VAULT_PATH}`)
  const result = await exportProjectToObsidianVault(PROJECT_ID, VAULT_PATH)
  console.log(`Created ${result.createdFiles.length} files:`)
  for (const f of result.createdFiles) console.log('  ', f)
}

main()
  .catch((err) => {
    console.error('Export failed:', err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
