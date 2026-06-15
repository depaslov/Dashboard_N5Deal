import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getOrCreateCurrentProject } from '@/lib/project'
import { ContentStudioForm } from '@/components/app/content-studio-form'

export const dynamic = 'force-dynamic'

// Press releases share the brief shape with pages (keywords with MIN/MAX,
// anchors, KB, structure, ICP) so we reuse the same studio form. The form's
// `contentType="press-releases"` triggers the press-release prompt module
// downstream in lib/content-studio.ts → composePrompt(). Features mirror
// pages: document reference, bulk mode (one PR per row in a list), SEO
// fields. Platforms are filtered to article-style channels — wires accept
// AP Style copy as articles.
export default async function PressReleasesPage() {
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
      contentType="press-releases"
      title="Press Releases"
      description="Generate AP Style press releases for paid wires (PRNewswire, BusinessWire, GlobeNewswire) and free aggregators / industry blogs. One format covers both. Boilerplate is pulled from the knowledge base; quotes are generated in the company's voice and editable in the editor. Bulk mode lets you produce N releases from a list (e.g. 10 announcement topics → 10 drafts)."
      icps={icps}
      platforms={platforms}
      features={{ document: true, bulk: true, seo: true }}
    />
  )
}
