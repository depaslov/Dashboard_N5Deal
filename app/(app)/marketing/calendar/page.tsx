import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getOrCreateCurrentProject } from '@/lib/project'
import { startOfWeek } from 'date-fns'
import { CalendarWeek } from './calendar-week'

export const dynamic = 'force-dynamic'

export default async function MarketingCalendarPage({
  searchParams,
}: {
  searchParams: { week?: string }
}) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id as string
  const project = await getOrCreateCurrentProject(userId)

  const weekStart = searchParams.week
    ? startOfWeek(new Date(searchParams.week), { weekStartsOn: 1 })
    : startOfWeek(new Date(), { weekStartsOn: 1 })
  weekStart.setHours(0, 0, 0, 0)

  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 7)

  const [accounts, posts] = await Promise.all([
    prisma.socialAccount.findMany({
      where: { projectId: project.id },
      orderBy: { sortOrder: 'asc' },
    }),
    prisma.socialPost.findMany({
      where: {
        projectId: project.id,
        scheduledFor: { gte: weekStart, lt: weekEnd },
      },
      include: { account: true },
      orderBy: { scheduledFor: 'asc' },
    }),
  ])

  return (
    <CalendarWeek
      accounts={accounts.map((a) => ({ id: a.id, slug: a.slug, name: a.name, color: a.color }))}
      posts={posts.map((p) => ({
        id: p.id,
        accountId: p.accountId,
        accountSlug: p.account.slug,
        type: p.type,
        title: p.title,
        platforms: p.platforms,
        scheduledFor: p.scheduledFor.toISOString(),
        status: p.status,
        imageCount: Array.isArray(p.images) ? (p.images as unknown[]).length : 0,
      }))}
      weekStartISO={weekStart.toISOString()}
    />
  )
}
