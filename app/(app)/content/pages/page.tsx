import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getOrCreateCurrentProject } from '@/lib/project'
import { ContentStudioForm } from '@/components/app/content-studio-form'

export const dynamic = 'force-dynamic'

export default async function PagesPage() {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id as string
  const project = await getOrCreateCurrentProject(userId)
  const [icps, platforms] = await Promise.all([
    prisma.iCP.findMany({ where: { projectId: project.id }, orderBy: { createdAt: 'asc' }, select: { id: true, name: true } }),
    prisma.platform.findMany({
      where: { projectId: project.id, isActive: true, formatType: 'article' },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, slug: true, formatType: true },
    }),
  ])
  return (
    <ContentStudioForm
      contentType="pages"
      title="Pages"
      description="Generate landing/listing pages — one item per page. Bulk mode lets you produce N pages from a list (e.g. 20 license pages from 20 license names)."
      icps={icps}
      platforms={platforms}
      features={{ document: true, bulk: true, seo: true }}
    />
  )
}
