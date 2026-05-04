import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getOrCreateCurrentProject } from '@/lib/project'
import { PageHeader } from '@/components/app/page-header'
import { PlatformsClient } from './platforms-client'

export const dynamic = 'force-dynamic'

export default async function PlatformsPage() {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id as string
  const project = await getOrCreateCurrentProject(userId)

  const platforms = await prisma.platform.findMany({
    where: { projectId: project.id },
    orderBy: { name: 'asc' },
  })

  return (
    <div className="max-w-[1100px] mx-auto">
      <PageHeader
        title="Platforms"
        description="Directory of publishing platforms (Medium, LinkedIn, Reddit, etc.). Each platform's format, tone, and prompt fragment is injected into Content Studio when picked."
      />
      <PlatformsClient
        initialPlatforms={platforms.map((p) => ({
          id: p.id,
          name: p.name,
          slug: p.slug,
          formatType: p.formatType,
          minLength: p.minLength,
          maxLength: p.maxLength,
          lengthUnit: p.lengthUnit,
          tone: p.tone,
          hashtagRules: p.hashtagRules,
          disclaimers: p.disclaimers,
          promptFragment: p.promptFragment,
          isActive: p.isActive,
        }))}
      />
    </div>
  )
}
