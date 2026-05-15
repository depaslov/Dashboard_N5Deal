import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getOrCreateCurrentProject } from '@/lib/project'
import { PageHeader } from '@/components/app/page-header'
import { CompanyBoard, type CompanySection } from './company-board'

export const dynamic = 'force-dynamic'

export default async function CompanyInfoPage() {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id as string
  const project = await getOrCreateCurrentProject(userId)

  const sections = await prisma.companyInfoSection.findMany({
    where: { projectId: project.id },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  })

  // Count of Obsidian files available for import (separate fetch endpoint
  // hydrates the full list inside the dialog so the page stays light).
  const obsidianChunkCount = await prisma.embeddingChunk.count({
    where: { scope: `project:${project.id}:obsidian` },
  })

  const data: CompanySection[] = sections.map((s) => ({
    id: s.id,
    title: s.title,
    type: s.type,
    content: s.content,
    sortOrder: s.sortOrder,
    isPublished: s.isPublished,
    source: s.source,
    sourcePath: s.sourcePath ?? null,
    updatedAt: s.updatedAt.toISOString(),
  }))

  return (
    <div className="max-w-[1200px] mx-auto">
      <PageHeader
        title="Company"
        description="Single source of truth for everything about the company — about, team, products, facts, press. Edit freely, or import from MyVault."
      />
      <CompanyBoard initial={data} hasObsidianContent={obsidianChunkCount > 0} />
    </div>
  )
}
