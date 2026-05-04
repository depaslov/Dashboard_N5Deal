import { RetrievalQAChain } from 'langchain/chains'
import { MemoryVectorStore } from 'langchain/vectorstores/memory'
import { prisma } from '@/lib/db'
import { getEmbeddings, getLLM } from './embeddings'
import {
  hashContent,
  syncScopeItems,
  loadVectorStoreForScopes,
} from './embedding-store'
import { obsidianScope } from './obsidian-sync'
import { userDocScope } from './document-processor'

export function projectDataScope(projectId: string): string {
  return `project:${projectId}:data`
}

// Sync the small structured project data (ICPs, contents, red flags, links)
// into the embedding cache. Items unchanged since the last sync are NOT
// re-embedded — `syncScopeItems` compares fileHash and skips matches.
export async function syncProjectData(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      icps: true,
      contents: true,
      redFlagWords: true,
      internalLinks: true,
    },
  })
  if (!project) return { embedded: 0, reused: 0, deleted: 0 }

  const items = [
    ...project.icps.map((icp) => {
      const content = `ICP: ${icp.name}. Industry: ${icp.industry}. Company Size: ${icp.companySize}. Pain Points: ${icp.painPoints.join(', ')}. Goals: ${icp.goals.join(', ')}. Demographics: ${icp.demographics}. Budget: ${icp.budgetRange}. Decision Process: ${icp.decisionProcess}`
      return {
        key: `icp:${icp.id}`,
        fileHash: hashContent(content),
        chunks: [{ content, metadata: { type: 'icp', id: icp.id, projectId } }],
      }
    }),
    ...project.contents.map((c) => {
      const content = `Content: ${c.topic}. Type: ${c.contentType}. Audience: ${c.targetAudience}. Tone: ${c.tone}. Brief: ${c.generatedBrief}`
      return {
        key: `content:${c.id}`,
        fileHash: hashContent(content),
        chunks: [
          {
            content,
            metadata: {
              type: 'content',
              id: c.id,
              projectId,
              contentType: c.contentType,
              topic: c.topic,
            },
          },
        ],
      }
    }),
    ...project.redFlagWords.map((flag) => {
      const content = `Red Flag: ${flag.word}. Category: ${flag.category}. Severity: ${flag.severity}. Reason: ${flag.reason || 'N/A'}`
      return {
        key: `redflag:${flag.id}`,
        fileHash: hashContent(content),
        chunks: [{ content, metadata: { type: 'redflag', id: flag.id, projectId } }],
      }
    }),
    ...project.internalLinks.map((link) => {
      const content = `Internal Link: ${link.url}. Anchor: ${link.anchor}. Context: ${link.context || 'N/A'}. Priority: ${link.priority}`
      return {
        key: `link:${link.id}`,
        fileHash: hashContent(content),
        chunks: [{ content, metadata: { type: 'link', id: link.id, projectId } }],
      }
    }),
  ]

  return syncScopeItems(projectDataScope(projectId), items, { purgeMissingKeys: true })
}

// Build a vector store covering project data (and Obsidian if synced).
// Vectors are loaded from the cache — no re-embedding here.
export async function getProjectVectorStore(projectId: string): Promise<MemoryVectorStore> {
  await syncProjectData(projectId)
  return loadVectorStoreForScopes([
    projectDataScope(projectId),
    obsidianScope(projectId),
  ])
}

export async function queryRAG(projectId: string, question: string) {
  const vectorStore = await getProjectVectorStore(projectId)
  const chain = RetrievalQAChain.fromLLM(getLLM(), vectorStore.asRetriever(4))
  const result = await chain.call({ query: question })
  return { answer: result.text as string }
}

export async function queryUserDocumentRAG(
  userId: string,
  fileName: string,
  question: string,
) {
  const vectorStore = await loadVectorStoreForScopes([userDocScope(userId)])
  // Restrict to the requested file inside this user's scope.
  const filter = (doc: any) => doc?.metadata?.source === fileName
  const chain = RetrievalQAChain.fromLLM(
    getLLM(),
    vectorStore.asRetriever({ k: 4, filter }),
  )
  const result = await chain.call({ query: question })
  return { answer: result.text as string }
}

// Find the most similar previously-generated content in this project.
// Used by /api/content/generate to skip the LLM call when the same brief
// has already been generated. Returns null if nothing crosses the threshold.
export async function findSimilarGeneratedContent(
  projectId: string,
  briefDigest: string,
  options: { contentType?: string; threshold?: number } = {},
): Promise<{ contentId: string; similarity: number; topic: string; generatedBrief: string } | null> {
  const threshold = options.threshold ?? 0.92
  await syncProjectData(projectId)
  const store = await loadVectorStoreForScopes([projectDataScope(projectId)])
  const results = await store.similaritySearchWithScore(briefDigest, 8)
  for (const [doc, score] of results) {
    if (doc.metadata?.type !== 'content') continue
    if (options.contentType && doc.metadata?.contentType !== options.contentType) continue
    if (score < threshold) continue
    const contentId = doc.metadata?.id as string | undefined
    if (!contentId) continue
    const row = await prisma.generatedContent.findUnique({ where: { id: contentId } })
    if (!row || row.projectId !== projectId) continue
    return {
      contentId,
      similarity: score,
      topic: row.topic,
      generatedBrief: row.generatedBrief,
    }
  }
  return null
}

// Embed a free-form text using the configured embeddings provider.
// Used for ad-hoc similarity probes (e.g. dedupe checks).
export async function embedQuery(text: string): Promise<number[]> {
  return getEmbeddings().embedQuery(text)
}
