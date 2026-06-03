// Export the Obsidian-vault knowledge base from the database into ONE
// big Markdown file at the project root.
//
// What it does:
//   - Reads every EmbeddingChunk in scope `project:<projectId>:obsidian`
//   - Groups chunks by their `key` (Obsidian file path) and stitches each
//     file's chunks back together in `chunkIndex` order
//   - Strips Obsidian frontmatter (---\n...\n---) from each file
//   - Writes one big `KNOWLEDGE_BASE.md` with a `# <filename>` header per file
//
// Reads from whatever DATABASE_URL is currently set in .env.
// Usage: npm run export-kb   (or: npx tsx --require dotenv/config scripts/export-knowledge-base.ts)

import { prisma } from '../lib/db'
import * as fs from 'fs'
import * as path from 'path'

const PROJECT_ID = process.env.PROJECT_ID || 'seed-project-n5deal'
const SCOPE = `project:${PROJECT_ID}:obsidian`
const OUTPUT_PATH = path.resolve(__dirname, '..', 'KNOWLEDGE_BASE.md')

interface ChunkRow {
  key: string
  chunkIndex: number
  content: string
  metadata: any
}

function fileTitleFromKey(key: string, meta: any): string {
  const fromMeta = meta?.frontMatter?.title
  if (typeof fromMeta === 'string' && fromMeta.trim()) return fromMeta.trim()
  const last = key.split('/').pop() ?? key
  return last.replace(/\.md$/i, '').trim()
}

function stripFrontmatter(text: string): string {
  return text.replace(/^---[\s\S]*?---\s*/m, '').trim()
}

async function main() {
  console.log(`Reading EmbeddingChunks for scope: ${SCOPE}`)
  const chunks = await prisma.embeddingChunk.findMany({
    where: { scope: SCOPE },
    select: { key: true, chunkIndex: true, content: true, metadata: true },
    orderBy: [{ key: 'asc' }, { chunkIndex: 'asc' }],
  })
  console.log(`  → ${chunks.length} chunks fetched`)

  if (chunks.length === 0) {
    console.error('No knowledge-base chunks found. Wrong DATABASE_URL or empty project?')
    process.exit(1)
  }

  // Group by key, preserving chunkIndex order (already sorted by the query).
  const byKey = new Map<string, ChunkRow[]>()
  for (const c of chunks) {
    const arr = byKey.get(c.key) ?? []
    arr.push(c as ChunkRow)
    byKey.set(c.key, arr)
  }
  console.log(`  → ${byKey.size} unique files to export`)

  // Build the output. Each file gets an H1 with its title + a small line
  // showing the original Obsidian path, then the stitched body.
  const sections: string[] = []
  sections.push('# N5Deal — Knowledge Base')
  sections.push('')
  sections.push(`*Exported from the project's Obsidian vault index.*`)
  sections.push(`*Files: ${byKey.size} · Chunks: ${chunks.length}*`)
  sections.push('')
  sections.push('---')
  sections.push('')

  // Table of contents
  sections.push('## Contents')
  sections.push('')
  const sortedKeys = [...byKey.keys()].sort((a, b) => a.localeCompare(b))
  for (const key of sortedKeys) {
    const meta = byKey.get(key)![0]?.metadata
    const title = fileTitleFromKey(key, meta)
    // Markdown auto-anchors lowercase + dash-separated; here we just emit a
    // plain bullet and let GitHub / IDE generate anchors automatically.
    sections.push(`- ${title} <sub><sup>· \`${key}\`</sup></sub>`)
  }
  sections.push('')
  sections.push('---')
  sections.push('')

  // Each file body
  for (const key of sortedKeys) {
    const fileChunks = byKey.get(key)!
    const meta = fileChunks[0]?.metadata
    const title = fileTitleFromKey(key, meta)
    const stitched = stripFrontmatter(fileChunks.map((c) => c.content).join('\n'))
    sections.push(`## ${title}`)
    sections.push('')
    sections.push(`> Source: \`${key}\``)
    sections.push('')
    sections.push(stitched)
    sections.push('')
    sections.push('---')
    sections.push('')
  }

  const output = sections.join('\n')
  fs.writeFileSync(OUTPUT_PATH, output, 'utf8')

  const sizeKb = (output.length / 1024).toFixed(1)
  console.log(`\n✓ Wrote ${OUTPUT_PATH}`)
  console.log(`  ${output.length.toLocaleString()} chars (~${sizeKb} KB), ${byKey.size} files`)
}

main()
  .catch((e) => { console.error('ERROR:', e.message); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
