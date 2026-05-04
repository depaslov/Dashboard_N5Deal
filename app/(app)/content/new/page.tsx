import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getOrCreateCurrentProject } from '@/lib/project'
import { PageHeader } from '@/components/app/page-header'
import { Button } from '@/components/ui/button'
import { ContentGenerator } from '@/components/app/content-generator'
import { ArrowLeft } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function NewContentPage({ searchParams }: { searchParams: { type?: string } }) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id as string
  const project = await getOrCreateCurrentProject(userId)

  const [icps, redFlags, internalLinks] = await Promise.all([
    prisma.iCP.findMany({
      where: { projectId: project.id },
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true, industry: true, painPoints: true, goals: true, budgetRange: true, demographics: true },
    }),
    prisma.redFlagWord.findMany({
      where: { projectId: project.id },
      orderBy: [{ category: 'asc' }, { word: 'asc' }],
      select: { id: true, word: true, category: true, severity: true, language: true, reason: true },
    }),
    prisma.internalLink.findMany({
      where: { projectId: project.id, isActive: true },
      orderBy: [{ priority: 'asc' }, { anchor: 'asc' }],
      select: { id: true, url: true, anchor: true, anchorAlts: true, context: true, category: true, priority: true, isActive: true },
    }),
  ])

  const defaultType = (searchParams?.type ?? 'article') as string

  return (
    <div className="max-w-[1400px] mx-auto">
      <div className="mb-4">
        <Button asChild variant="ghost" size="sm">
          <Link href="/content" className="gap-1">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Content Studio
          </Link>
        </Button>
      </div>
      <PageHeader
        title="Generate new content"
        description="Fill a TZ-style brief — the AI follows it precisely and avoids your red-flag words."
      />
      <ContentGenerator
        defaultType={defaultType}
        icps={icps.map((i: any) => ({
          id: i.id,
          name: i.name,
          industry: i.industry,
          painPoints: i.painPoints ?? [],
          goals: i.goals ?? [],
          budgetRange: i.budgetRange,
          demographics: i.demographics,
        }))}
        projectRedFlags={redFlags.map((r: any) => ({
          id: r.id,
          word: r.word,
          category: r.category,
          severity: r.severity,
          language: r.language,
          reason: r.reason,
        }))}
        projectInternalLinks={internalLinks.map((l: any) => ({
          id: l.id,
          url: l.url,
          anchor: l.anchor,
          anchorAlts: l.anchorAlts ?? [],
          context: l.context,
          category: l.category,
          priority: l.priority,
          isActive: l.isActive,
        }))}
      />
    </div>
  )
}
