import fs from 'fs/promises'
import path from 'path'
import matter from 'gray-matter'
import { Document } from 'langchain/document'
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter'
import { safeResolveVaultPath, assertDirectoryExists } from './safe-path'
import { hashContent, syncScopeItems, type SourceItem, type SyncResult } from './embedding-store'

const VAULT_FILE_LIMIT = 5000 // hard cap to avoid runaway recursion

export function obsidianScope(projectId: string): string {
  return `project:${projectId}:obsidian`
}

async function readMarkdownFiles(dir: string, root: string, acc: string[]): Promise<void> {
  if (acc.length >= VAULT_FILE_LIMIT) return
  const entries = await fs.readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue
    if (['.git', 'node_modules', '.obsidian'].includes(entry.name)) continue
    const entryPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      await readMarkdownFiles(entryPath, root, acc)
      continue
    }
    if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
      acc.push(entryPath)
      if (acc.length >= VAULT_FILE_LIMIT) return
    }
  }
}

const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 800,
  chunkOverlap: 100,
})

// Load all markdown files in a vault as Documents (without embedding).
// Useful for one-shot in-memory RAG when the cache is bypassed.
export async function loadObsidianVaultDocuments(vaultPath: string): Promise<Document[]> {
  const resolved = safeResolveVaultPath(vaultPath)
  await assertDirectoryExists(resolved)

  const files: string[] = []
  await readMarkdownFiles(resolved, resolved, files)

  const documents: Document[] = []
  for (const filePath of files) {
    const raw = await fs.readFile(filePath, 'utf-8')
    const { content, data } = matter(raw)
    const relativePath = path.relative(resolved, filePath)
    const chunks = await splitter.splitText(content)
    chunks.forEach((chunk, index) => {
      documents.push(
        new Document({
          pageContent: chunk,
          metadata: {
            source: 'obsidian',
            filePath: relativePath,
            vaultPath: resolved,
            frontMatter: data ?? {},
            chunkIndex: index,
          },
        }),
      )
    })
  }
  return documents
}

// Incremental sync: walks the vault, hashes each file, embeds only changed
// or new files, and removes entries for deleted files. All chunks live in
// the EmbeddingChunk table under `obsidianScope(projectId)`.
export async function syncObsidianVault(
  projectId: string,
  vaultPath: string,
): Promise<SyncResult & { vaultPath: string; fileCount: number }> {
  const resolved = safeResolveVaultPath(vaultPath)
  await assertDirectoryExists(resolved)

  const files: string[] = []
  await readMarkdownFiles(resolved, resolved, files)

  const items: SourceItem[] = []
  for (const filePath of files) {
    const raw = await fs.readFile(filePath, 'utf-8')
    const { content, data } = matter(raw)
    const relativePath = path.relative(resolved, filePath)
    const fileHash = hashContent(raw)
    const chunkTexts = await splitter.splitText(content)
    items.push({
      key: relativePath,
      fileHash,
      chunks: chunkTexts.map((c, i) => ({
        content: c,
        metadata: {
          source: 'obsidian',
          filePath: relativePath,
          vaultPath: resolved,
          frontMatter: data ?? {},
          chunkIndex: i,
        },
      })),
    })
  }

  const result = await syncScopeItems(obsidianScope(projectId), items, {
    purgeMissingKeys: true,
  })

  return { ...result, vaultPath: resolved, fileCount: files.length }
}
