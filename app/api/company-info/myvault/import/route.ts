import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getOrCreateCurrentProject } from '@/lib/project'

export const dynamic = 'force-dynamic'

const TYPES = ['about', 'team', 'products', 'facts', 'links', 'press', 'timeline', 'mission', 'values', 'other'] as const

const BodySchema = z.object({
  key: z.string().min(1),
  type: z.enum(TYPES).default('about'),
  title: z.string().min(1).max(300).optional(),
})

// Pulls all RAG chunks for a single Obsidian file (by key), stitches them
// back into one document, and creates a CompanyInfoSection with the result.
export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id as string | undefined
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const project = await getOrCreateCurrentProject(userId)

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid fields' }, { status: 400 })
  }

  const scope = `project:${project.id}:obsidian`
  const chunks = await prisma.embeddingChunk.findMany({
    where: { scope, key: parsed.data.key },
    orderBy: { chunkIndex: 'asc' },
    select: { content: true, metadata: true },
  })
  if (chunks.length === 0) {
    return NextResponse.json({ error: 'No content found in MyVault for this key' }, { status: 404 })
  }

  // Stitch chunks + strip frontmatter for a clean section body
  const joined = chunks.map((c) => c.content).join('\n').replace(/^---[\s\S]*?---\s*/m, '').trim()

  // Resolve title (caller can override; otherwise from frontmatter or filename)
  const meta = chunks[0]?.metadata as { frontMatter?: { title?: string } } | null
  const fallbackTitle =
    parsed.data.title?.trim() ||
    meta?.frontMatter?.title ||
    parsed.data.key.split('/').pop()?.replace(/\.md$/, '') ||
    'Imported from MyVault'

  // Pick next sortOrder
  const max = await prisma.companyInfoSection.aggregate({
    where: { projectId: project.id },
    _max: { sortOrder: true },
  })
  const sortOrder = (max._max.sortOrder ?? -1) + 1

  const section = await prisma.companyInfoSection.create({
    data: {
      projectId: project.id,
      title: fallbackTitle,
      type: parsed.data.type,
      content: joined,
      isPublished: false,
      sortOrder,
      source: 'obsidian',
      sourcePath: parsed.data.key,
    },
  })

  return NextResponse.json({ section })
}
