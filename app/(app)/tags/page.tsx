import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getOrCreateCurrentProject } from '@/lib/project'
import { PageHeader } from '@/components/app/page-header'
import { TagsClient } from './tags-client'

export const dynamic = 'force-dynamic'

export default async function TagsPage() {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id as string
  const project = await getOrCreateCurrentProject(userId)

  const tags = await prisma.tag.findMany({
    where: { projectId: project.id },
    orderBy: { name: 'asc' },
    include: { _count: { select: { icps: true } } },
  })

  return (
    <div className="max-w-[900px] mx-auto">
      <PageHeader
        title="Tags"
        description="Project-scoped reusable labels you can apply to ICPs."
      />
      <TagsClient
        initialTags={tags.map((t) => ({
          id: t.id,
          name: t.name,
          color: t.color,
          icpCount: t._count.icps,
        }))}
      />
    </div>
  )
}
