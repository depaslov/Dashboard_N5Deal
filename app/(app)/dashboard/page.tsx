import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getOrCreateCurrentProject, getUserProjects } from '@/lib/project'
import { PageHeader } from '@/components/app/page-header'
import { PlatformSwitcher } from '@/components/app/platform-switcher'
import { StatCard } from '@/components/app/stat-card'
import { Button } from '@/components/ui/button'
import {
  Sparkles,
  Plus,
  ArrowRight,
  Linkedin,
  Send,
  FileText,
  BookOpen,
  Clock,
  Layout,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

export const dynamic = 'force-dynamic'

const CONTENT_TYPE_META: Record<string, { label: string; icon: any }> = {
  article: { label: 'Article', icon: FileText },
  catalog: { label: 'Catalog', icon: BookOpen },
  linkedin: { label: 'LinkedIn', icon: Linkedin },
  telegram: { label: 'Telegram', icon: Send },
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id as string
  const project = await getOrCreateCurrentProject(userId)
  const projects = await getUserProjects(userId)

  const [contentCount, recentContents, socialPostsCount, redFlagsCount] = await Promise.all([
    prisma.generatedContent.count({ where: { projectId: project.id } }),
    prisma.generatedContent.findMany({
      where: { projectId: project.id },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { createdBy: true },
    }),
    prisma.socialPost.count({ where: { projectId: project.id } }),
    prisma.redFlagWord.count({ where: { projectId: project.id } }),
  ])

  return (
    <div className="max-w-[1200px] mx-auto">
      <PageHeader
        title={`Welcome back, ${(session?.user?.name ?? 'there').split(' ')[0]}`}
        description={`Overview of ${project?.name ?? 'your workspace'} — recent content and quick actions.`}
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/icps/new" className="gap-2">
                <Plus className="h-4 w-4" /> New ICP
              </Link>
            </Button>
            <Button asChild>
              <Link href="/content/new" className="gap-2">
                <Sparkles className="h-4 w-4" /> Generate content
              </Link>
            </Button>
          </>
        }
      />

      {/* Platform selector */}
      <PlatformSwitcher
        currentId={project.id}
        platforms={projects.map((p: any) => ({
          id: p.id,
          name: p.name,
          companyName: p.companyName,
          brandBadge: p.brandBadge ?? null,
          brandColor: p.brandColor ?? null,
        }))}
      />

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link href="/content" className="block">
          <StatCard
            label="Content Generated"
            value={contentCount}
            iconName="sparkles"
            accent="accent"
            hint="Click to browse all briefs"
          />
        </Link>
        <Link href="/marketing/calendar" className="block">
          <StatCard
            label="Marketing Posts"
            value={socialPostsCount}
            iconName="folder"
            accent="default"
            hint="Scheduled across all accounts"
          />
        </Link>
        <Link href="/red-flags" className="block">
          <StatCard
            label="Red Flags"
            value={redFlagsCount}
            iconName="file"
            accent="warning"
            hint="Compliance terms in dictionary"
          />
        </Link>
      </div>

      {/* Recent activity + Quick actions */}
      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 bg-card border border-border shadow-sm">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <div>
              <h2 className="font-display font-semibold text-lg tracking-tight">Recent content</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Latest AI-generated briefs for this workspace</p>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/content" className="gap-1">
                View all <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
          <div>
            {(recentContents?.length ?? 0) === 0 ? (
              <div className="p-10 text-center">
                <Sparkles className="h-8 w-8 mx-auto text-muted-foreground" />
                <p className="mt-3 text-sm text-muted-foreground">No content yet. Generate your first brief.</p>
                <Button asChild size="sm" className="mt-4">
                  <Link href="/content/new">Start generating</Link>
                </Button>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {(recentContents ?? []).map((c: any) => {
                  const meta = CONTENT_TYPE_META[c?.contentType] ?? CONTENT_TYPE_META.article
                  const Icon = meta.icon
                  return (
                    <li key={c?.id}>
                      <Link
                        href={`/content/${c?.id}`}
                        className="flex items-start gap-4 px-6 py-4 hover:bg-secondary/60 transition-colors"
                      >
                        <div className="flex h-9 w-9 items-center justify-center bg-secondary shrink-0">
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium text-sm truncate">{c?.topic}</p>
                            <span className="text-[10px] uppercase tracking-widest bg-secondary px-1.5 py-0.5 text-muted-foreground font-medium">
                              {meta.label}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">
                            {c?.targetAudience} • {c?.tone}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                          <Clock className="h-3 w-3" />
                          {c?.createdAt ? formatDistanceToNow(new Date(c.createdAt), { addSuffix: true }) : ''}
                        </div>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-card border border-border shadow-sm">
            <div className="px-6 py-4 border-b border-border">
              <h2 className="font-display font-semibold text-lg tracking-tight">Quick actions</h2>
            </div>
            <div className="p-4 space-y-2">
              <Button asChild variant="outline" className="w-full justify-start">
                <Link href="/content/new?type=article" className="gap-2">
                  <FileText className="h-4 w-4" /> Article brief
                </Link>
              </Button>
              <Button asChild variant="outline" className="w-full justify-start">
                <Link href="/content/new?type=pages" className="gap-2">
                  <Layout className="h-4 w-4" /> Page generation
                </Link>
              </Button>
              <Button asChild variant="outline" className="w-full justify-start">
                <Link href="/content/new?type=linkedin" className="gap-2">
                  <Linkedin className="h-4 w-4" /> LinkedIn post brief
                </Link>
              </Button>
              <Button asChild variant="outline" className="w-full justify-start">
                <Link href="/content/new?type=telegram" className="gap-2">
                  <Send className="h-4 w-4" /> Telegram post brief
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
