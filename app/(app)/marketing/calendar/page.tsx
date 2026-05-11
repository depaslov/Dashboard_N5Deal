import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getOrCreateCurrentProject } from '@/lib/project'
import { startOfWeek, endOfMonth, startOfMonth } from 'date-fns'
import { CalendarBoard } from './calendar-board'

export const dynamic = 'force-dynamic'

export default async function MarketingCalendarPage({
  searchParams,
}: {
  searchParams: { week?: string; view?: string }
}) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id as string
  const project = await getOrCreateCurrentProject(userId)

  // Anchor date — defaults to today; ?week=YYYY-MM-DD overrides
  const anchor = searchParams.week ? new Date(searchParams.week) : new Date()
  anchor.setHours(0, 0, 0, 0)

  // Pull a wide window so List / Month views have data without a refetch.
  const windowStart = startOfMonth(anchor)
  windowStart.setHours(0, 0, 0, 0)
  const windowEnd = endOfMonth(anchor)
  windowEnd.setHours(23, 59, 59, 999)
  // Extend window by ±2 weeks so prev/next nav inside the same view is cheap.
  windowStart.setDate(windowStart.getDate() - 14)
  windowEnd.setDate(windowEnd.getDate() + 14)

  const [accounts, posts] = await Promise.all([
    prisma.socialAccount.findMany({
      where: { projectId: project.id },
      orderBy: { sortOrder: 'asc' },
    }),
    prisma.socialPost.findMany({
      where: {
        projectId: project.id,
        scheduledFor: { gte: windowStart, lte: windowEnd },
      },
      include: { account: true },
      orderBy: { scheduledFor: 'asc' },
    }),
  ])

  return (
    <CalendarBoard
      accounts={accounts.map((a) => ({ id: a.id, slug: a.slug, name: a.name, color: a.color }))}
      posts={posts.map((p) => ({
        id: p.id,
        accountId: p.accountId,
        accountSlug: p.account.slug,
        type: p.type,
        title: p.title,
        content: p.content ?? '',
        platforms: p.platforms,
        scheduledFor: p.scheduledFor.toISOString(),
        status: p.status,
        notes: p.notes ?? '',
        postUrl: p.postUrl ?? '',
        imageCount: Array.isArray(p.images) ? (p.images as unknown[]).length : 0,
      }))}
      weekStartISO={startOfWeek(anchor, { weekStartsOn: 1 }).toISOString()}
      anchorISO={anchor.toISOString()}
      initialView={(searchParams.view as 'week' | 'month' | 'list' | 'board') ?? 'week'}
    />
  )
}
