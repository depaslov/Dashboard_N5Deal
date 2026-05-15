import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getOrCreateCurrentProject } from '@/lib/project'

export const dynamic = 'force-dynamic'

// Lists every Obsidian-vault file that lives in the project's RAG store,
// grouped by file path. For each file we return a short preview + total
// chunk count so the user can pick what to import as a company-info section.
export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id as string | undefined
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const project = await getOrCreateCurrentProject(userId)
  const { searchParams } = new URL(req.url)
  const q = (searchParams.get('q') ?? '').trim().toLowerCase()

  const scope = `project:${project.id}:obsidian`

  // Get every chunk for this scope so we can group them by key.
  // 2.5k chunks is fine to hold in memory; if it grows we can paginate.
  const chunks = await prisma.embeddingChunk.findMany({
    where: { scope },
    select: { key: true, chunkIndex: true, content: true, metadata: true },
    orderBy: [{ key: 'asc' }, { chunkIndex: 'asc' }],
  })

  // Group by key (file path)
  const byKey = new Map<string, { content: string; count: number; metadata: unknown }>()
  for (const c of chunks) {
    const entry = byKey.get(c.key)
    if (entry) {
      entry.content += '\n' + c.content
      entry.count++
    } else {
      byKey.set(c.key, { content: c.content, count: 1, metadata: c.metadata })
    }
  }

  // Optional fulltext filter (matches key or first 500 chars of content)
  const files = [...byKey.entries()]
    .filter(([key, v]) => {
      if (!q) return true
      return key.toLowerCase().includes(q) || v.content.slice(0, 500).toLowerCase().includes(q)
    })
    .map(([key, v]) => {
      const meta = v.metadata as { frontMatter?: { title?: string } } | null
      // Strip Obsidian frontmatter ('---\n...\n---\n') from preview
      const cleanContent = v.content.replace(/^---[\s\S]*?---\s*/m, '').trim()
      const title = meta?.frontMatter?.title ?? key.split('/').pop()?.replace(/\.md$/, '') ?? key
      return {
        key,
        title,
        preview: cleanContent.slice(0, 320).replace(/\n+/g, ' ').trim(),
        chunkCount: v.count,
        fullChars: v.content.length,
      }
    })
    .sort((a, b) => a.key.localeCompare(b.key))

  return NextResponse.json({ files, total: files.length })
}
