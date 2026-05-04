import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getOrCreateCurrentProject } from '@/lib/project'
import { PageHeader } from '@/components/app/page-header'
import { InternalLinksClient } from './internal-links-client'

export const dynamic = 'force-dynamic'

export default async function InternalLinksPage() {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id as string
  const project = await getOrCreateCurrentProject(userId)

  const links = await prisma.internalLink.findMany({
    where: { projectId: project.id },
    orderBy: [{ priority: 'asc' }, { category: 'asc' }, { url: 'asc' }],
  })

  return (
    <div className="max-w-[1100px] mx-auto">
      <PageHeader
        title="Internal Links Library"
        description="Reusable destination URLs + anchor phrases. The AI can insert these automatically while writing articles."
      />
      <InternalLinksClient
        initialLinks={links.map((l: any) => ({
          id: l.id,
          url: l.url,
          anchor: l.anchor,
          anchorAlts: l.anchorAlts ?? [],
          context: l.context ?? '',
          category: l.category ?? '',
          priority: l.priority,
          isActive: l.isActive,
        }))}
      />
    </div>
  )
}
