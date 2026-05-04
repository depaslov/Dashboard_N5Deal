import crypto from 'crypto'
import { Document } from 'langchain/document'
import { MemoryVectorStore } from 'langchain/vectorstores/memory'
import { prisma } from '@/lib/db'
import { getEmbeddings } from './embeddings'

export function hashContent(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex')
}

export interface SourceItem {
  key: string
  fileHash: string
  chunks: { content: string; metadata?: Record<string, any> }[]
}

export interface SyncResult {
  embedded: number
  reused: number
  deleted: number
}

// Sync a set of items under a `scope`. For each item, if `fileHash` matches
// the stored value we keep the existing chunks. Otherwise we delete the old
// chunks and embed+store the new ones. If `purgeMissingKeys` is true, any
// (scope, key) currently in the DB but not in `items` is also deleted.
export async function syncScopeItems(
  scope: string,
  items: SourceItem[],
  options: { purgeMissingKeys?: boolean } = {},
): Promise<SyncResult> {
  let embedded = 0
  let reused = 0
  let deleted = 0
  // Lazily resolved so a fully-cached sync run does not require the embeddings
  // provider to be configured.
  let embeddings: ReturnType<typeof getEmbeddings> | null = null

  for (const item of items) {
    const existing = await prisma.embeddingChunk.findFirst({
      where: { scope, key: item.key },
      select: { fileHash: true },
    })
    if (existing && existing.fileHash === item.fileHash) {
      reused += item.chunks.length
      continue
    }
    if (existing) {
      const r = await prisma.embeddingChunk.deleteMany({ where: { scope, key: item.key } })
      deleted += r.count
    }
    if (item.chunks.length === 0) continue
    if (!embeddings) embeddings = getEmbeddings()
    const vectors = await embeddings.embedDocuments(item.chunks.map((c) => c.content))
    await prisma.$transaction(
      item.chunks.map((c, i) =>
        prisma.embeddingChunk.create({
          data: {
            scope,
            key: item.key,
            fileHash: item.fileHash,
            chunkIndex: i,
            content: c.content,
            embedding: vectors[i],
            metadata: c.metadata ?? undefined,
          },
        }),
      ),
    )
    embedded += item.chunks.length
  }

  if (options.purgeMissingKeys) {
    const allowed = new Set(items.map((i) => i.key))
    const distinctKeys = await prisma.embeddingChunk.findMany({
      where: { scope },
      select: { key: true },
      distinct: ['key'],
    })
    const stale = distinctKeys.map((r) => r.key).filter((k) => !allowed.has(k))
    if (stale.length) {
      const r = await prisma.embeddingChunk.deleteMany({
        where: { scope, key: { in: stale } },
      })
      deleted += r.count
    }
  }

  return { embedded, reused, deleted }
}

// Build an in-memory vector store from previously cached embeddings.
// No re-embedding happens — this just hydrates vectors from the DB.
export async function loadVectorStoreForScopes(scopes: string[]): Promise<MemoryVectorStore> {
  const store = new MemoryVectorStore(getEmbeddings())
  if (scopes.length === 0) return store
  const rows = await prisma.embeddingChunk.findMany({
    where: { scope: { in: scopes } },
    orderBy: [{ scope: 'asc' }, { key: 'asc' }, { chunkIndex: 'asc' }],
  })
  if (rows.length === 0) return store
  const docs = rows.map(
    (r) =>
      new Document({
        pageContent: r.content,
        metadata: {
          scope: r.scope,
          key: r.key,
          chunkIndex: r.chunkIndex,
          ...((r.metadata as Record<string, any> | null) ?? {}),
        },
      }),
  )
  await store.addVectors(
    rows.map((r) => r.embedding as unknown as number[]),
    docs,
  )
  return store
}

export async function clearScope(scope: string): Promise<number> {
  const r = await prisma.embeddingChunk.deleteMany({ where: { scope } })
  return r.count
}
