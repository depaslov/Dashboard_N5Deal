import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getOrCreateCurrentProject } from '@/lib/project'
import { ContentStudioForm } from '@/components/app/content-studio-form'

export const dynamic = 'force-dynamic'

export default async function MarketNewsPage() {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id as string
  const project = await getOrCreateCurrentProject(userId)
  const [icps, platforms] = await Promise.all([
    prisma.iCP.findMany({ where: { projectId: project.id }, orderBy: { createdAt: 'asc' }, select: { id: true, name: true } }),
    prisma.platform.findMany({ where: { projectId: project.id, isActive: true }, orderBy: { name: 'asc' }, select: { id: true, name: true, slug: true, formatType: true } }),
  ])
  return (
    <ContentStudioForm
      contentType="market-news"
      title="Market News"
      description="Rephrase a source news article into N5Deal's voice. Paste source URL and (optionally) extracted text."
      icps={icps}
      platforms={platforms}
      features={{ sourceUrl: true, document: true }}
    />
  )
}
