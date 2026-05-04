import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getOrCreateCurrentProject } from '@/lib/project'
import { ContentStudioForm } from '@/components/app/content-studio-form'

export const dynamic = 'force-dynamic'

export default async function SocialPage() {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id as string
  const project = await getOrCreateCurrentProject(userId)
  const [icps, platforms] = await Promise.all([
    prisma.iCP.findMany({ where: { projectId: project.id }, orderBy: { createdAt: 'asc' }, select: { id: true, name: true } }),
    prisma.platform.findMany({
      where: { projectId: project.id, isActive: true, formatType: { in: ['post', 'thread'] } },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, slug: true, formatType: true },
    }),
  ])
  return (
    <ContentStudioForm
      contentType="social"
      title="Social Media"
      description="Single posts or threads. Per-platform tone, length, and hashtag rules apply automatically."
      icps={icps}
      platforms={platforms}
      features={{}}
    />
  )
}
