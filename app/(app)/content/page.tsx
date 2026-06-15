import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getOrCreateCurrentProject } from '@/lib/project'
import { PageHeader } from '@/components/app/page-header'
import { Button } from '@/components/ui/button'
import { ContentListClient } from './content-list-client'
import { Plus, Newspaper, BookText, Mail, Hash, Link2, FileText, Megaphone } from 'lucide-react'

const STUDIO_TYPES = [
  { href: '/content/articles',      label: 'Articles',       desc: 'Long-form articles with semantic core + KB grounding.', Icon: BookText },
  { href: '/content/pages',         label: 'Pages',          desc: 'Landing/listing pages — single or bulk (one per item).',Icon: FileText },
  { href: '/content/press-releases',label: 'Press Releases', desc: 'AP Style newswire copy for paid wires + free aggregators.', Icon: Megaphone },
  { href: '/content/market-news',   label: 'Market News',    desc: 'Rephrase a source article into N5Deal voice.',         Icon: Newspaper },
  { href: '/content/newsletter',    label: 'Newsletter',     desc: 'LinkedIn Newsletter issues.',                          Icon: Mail },
  { href: '/content/social',        label: 'Social Media',   desc: 'Single posts or threads, per-platform rules.',         Icon: Hash },
  { href: '/content/link-building', label: 'Link Building',  desc: 'Standalone-value pieces with one earned mention.',     Icon: Link2 },
]

export const dynamic = 'force-dynamic'

export default async function ContentPage() {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id as string
  const project = await getOrCreateCurrentProject(userId)

  const [contents, folders] = await Promise.all([
    prisma.generatedContent.findMany({
      where: { projectId: project.id },
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: true,
        // Need both counts to drive the orange status dot: total notes
        // give the tooltip ("3 notes, 1 resolved") and the unresolved
        // count decides whether the dot is orange or dashed.
        _count: { select: { annotations: true } },
        annotations: { where: { resolved: false }, select: { id: true } },
      },
    }),
    prisma.contentFolder.findMany({
      where: { projectId: project.id },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: { _count: { select: { contents: true } } },
    }),
  ])

  return (
    <div className="max-w-[1200px] mx-auto">
      <PageHeader
        title="Content Studio"
        description="Pick a content type below to start generating. All ICP, platform, and KB context is auto-injected."
        actions={
          <Button asChild variant="outline">
            <Link href="/content/new" className="gap-2">
              <Plus className="h-4 w-4" /> Quick brief (legacy)
            </Link>
          </Button>
        }
      />

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 mb-8">
        {STUDIO_TYPES.map(({ href, label, desc, Icon }) => (
          <Link
            key={href}
            href={href}
            className="bg-card border border-border p-4 hover:border-primary transition-colors flex gap-3"
          >
            <Icon className="h-5 w-5 mt-0.5 text-primary shrink-0" />
            <div>
              <p className="font-medium">{label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
            </div>
          </Link>
        ))}
      </div>

      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">History</h2>
      <ContentListClient
        items={contents.map((c: any) => ({
          id: c.id,
          contentType: c.contentType,
          topic: c.topic,
          targetAudience: c.targetAudience,
          tone: c.tone,
          createdAt: c.createdAt.toISOString(),
          createdByName: c?.createdBy?.name ?? '',
          folderId: c.folderId ?? null,
          annotationCount: c._count?.annotations ?? 0,
          unresolvedAnnotationCount: c.annotations?.length ?? 0,
        }))}
        folders={folders.map((f: any) => ({
          id: f.id,
          name: f.name,
          color: f.color ?? null,
          count: f._count.contents,
        }))}
      />
    </div>
  )
}
