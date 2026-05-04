import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getOrCreateCurrentProject } from '@/lib/project'
import { PageHeader } from '@/components/app/page-header'
import { StatCard } from '@/components/app/stat-card'
import { Button } from '@/components/ui/button'
import {
  Users,
  Sparkles,
  Plus,
  ArrowRight,
  Linkedin,
  Send,
  FileText,
  BookOpen,
  Clock,
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

  const [icpCount, contentCount, projectCount, recentContents, recentIcps] = await Promise.all([
    prisma.iCP.count({ where: { projectId: project.id } }),
    prisma.generatedContent.count({ where: { projectId: project.id } }),
    prisma.projectMember.count({ where: { userId } }),
    prisma.generatedContent.findMany({
      where: { projectId: project.id },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { createdBy: true },
    }),
    prisma.iCP.findMany({
      where: { projectId: project.id },
      orderBy: { createdAt: 'desc' },
      take: 4,
    }),
  ])

  return (
    <div className="max-w-[1200px] mx-auto">
      <PageHeader
        title={`Welcome back, ${(session?.user?.name ?? 'there').split(' ')[0]}`}
        description={`Overview of ${project?.name ?? 'your workspace'} — ICPs, content and recent activity.`}
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

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Total ICPs" value={icpCount} iconName="users" accent="default" hint="Ideal customer profiles saved" />
        <StatCard label="Content Generated" value={contentCount} iconName="sparkles" accent="accent" hint="Briefs created by AI" />
        <StatCard label="Active Projects" value={projectCount} iconName="folder" accent="success" hint="Workspaces you belong to" />
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
                <Link href="/icps/new" className="gap-2">
                  <Users className="h-4 w-4" /> Create a new ICP
                </Link>
              </Button>
              <Button asChild variant="outline" className="w-full justify-start">
                <Link href="/content/new?type=linkedin" className="gap-2">
                  <Linkedin className="h-4 w-4" /> LinkedIn post brief
                </Link>
              </Button>
              <Button asChild variant="outline" className="w-full justify-start">
                <Link href="/content/new?type=article" className="gap-2">
                  <FileText className="h-4 w-4" /> Article brief
                </Link>
              </Button>
              <Button asChild variant="outline" className="w-full justify-start">
                <Link href="/content/new?type=telegram" className="gap-2">
                  <Send className="h-4 w-4" /> Telegram post brief
                </Link>
              </Button>
            </div>
          </div>

          <div className="bg-card border border-border shadow-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="font-display font-semibold text-lg tracking-tight">Recent ICPs</h2>
              <Button asChild variant="ghost" size="sm">
                <Link href="/icps">All</Link>
              </Button>
            </div>
            <ul className="divide-y divide-border">
              {(recentIcps ?? []).map((icp: any) => (
                <li key={icp?.id}>
                  <Link href={`/icps/${icp?.id}`} className="flex items-start gap-3 px-6 py-3 hover:bg-secondary/60 transition-colors">
                    <div className="flex h-8 w-8 items-center justify-center bg-secondary shrink-0">
                      <Users className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{icp?.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{icp?.industry}</p>
                    </div>
                  </Link>
                </li>
              ))}
              {(recentIcps ?? []).length === 0 ? (
                <li className="p-6 text-center text-sm text-muted-foreground">No ICPs yet.</li>
              ) : null}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
