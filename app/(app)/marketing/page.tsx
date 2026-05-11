import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getOrCreateCurrentProject } from '@/lib/project'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ACCOUNT_META, ACCOUNT_ORDER, type AccountSlug, POST_STATUS_LABEL } from '@/lib/marketing/constants'
import { Calendar, Megaphone, BarChart3, Sparkles, Plus } from 'lucide-react'
import { formatDistanceToNow, startOfWeek, endOfWeek, isToday } from 'date-fns'

export const dynamic = 'force-dynamic'

export default async function MarketingHomePage() {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id as string
  const project = await getOrCreateCurrentProject(userId)

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const weekStart = startOfWeek(today, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(today, { weekStartsOn: 1 })
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1)
  const inAWeek = new Date(today); inAWeek.setDate(inAWeek.getDate() + 7)

  const [accounts, total, published, weekCount, todayPosts, upcoming, perAccount] = await Promise.all([
    prisma.socialAccount.findMany({
      where: { projectId: project.id },
      orderBy: { sortOrder: 'asc' },
    }),
    prisma.socialPost.count({ where: { projectId: project.id } }),
    prisma.socialPost.count({ where: { projectId: project.id, status: 'pub' } }),
    prisma.socialPost.count({
      where: { projectId: project.id, scheduledFor: { gte: weekStart, lte: weekEnd } },
    }),
    prisma.socialPost.findMany({
      where: {
        projectId: project.id,
        scheduledFor: { gte: today, lt: tomorrow },
      },
      include: { account: true },
      orderBy: { scheduledFor: 'asc' },
    }),
    prisma.socialPost.findMany({
      where: {
        projectId: project.id,
        scheduledFor: { gte: tomorrow, lt: inAWeek },
        status: { not: 'pub' },
      },
      include: { account: true },
      orderBy: { scheduledFor: 'asc' },
      take: 6,
    }),
    prisma.socialPost.groupBy({
      by: ['accountId', 'status'],
      where: { projectId: project.id },
      _count: { _all: true },
    }),
  ])

  // Aggregate per-account totals
  const perAcc = new Map<string, { total: number; pub: number }>()
  for (const a of accounts) perAcc.set(a.id, { total: 0, pub: 0 })
  for (const row of perAccount) {
    const cur = perAcc.get(row.accountId) ?? { total: 0, pub: 0 }
    cur.total += row._count._all
    if (row.status === 'pub') cur.pub += row._count._all
    perAcc.set(row.accountId, cur)
  }

  const pct = total > 0 ? Math.round((published / total) * 100) : 0

  if (total === 0) {
    return (
      <EmptyState />
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <KpiCard label="Total posts" value={total} hint="All scheduled content" />
        <KpiCard label="Published" value={published} hint={`${pct}% of total`} accent="text-amber-600 dark:text-amber-400" />
        <KpiCard label="This week" value={weekCount} hint="Mon → Sun" />
        <KpiCard label="Today" value={todayPosts.length} hint={`${todayPosts.filter(p => p.status === 'pub').length} posted`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2 bg-card border border-border rounded-lg shadow-sm">
          <header className="flex items-center justify-between px-5 py-3.5 border-b border-border">
            <div>
              <h2 className="font-semibold">Today's posts</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {today.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
              </p>
            </div>
            <Button asChild size="sm">
              <Link href="/marketing/calendar" className="gap-1.5">
                <Calendar className="h-3.5 w-3.5" /> Open calendar
              </Link>
            </Button>
          </header>
          {todayPosts.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-muted-foreground">
              Nothing scheduled today.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {todayPosts.map((p) => {
                const acc = ACCOUNT_META[p.account.slug as AccountSlug] ?? { name: p.account.name, color: p.account.color }
                return (
                  <li key={p.id} className="flex items-start gap-3 px-5 py-3.5">
                    <div className="h-2 w-2 mt-1.5 rounded-full" style={{ background: acc.color }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: acc.color }}>
                          {acc.name}
                        </span>
                        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{p.type}</span>
                        <Badge variant={p.status === 'pub' ? 'default' : 'outline'} className="text-[10px]">
                          {POST_STATUS_LABEL[p.status as keyof typeof POST_STATUS_LABEL] ?? p.status}
                        </Badge>
                      </div>
                      <p className="text-sm mt-1 font-medium truncate">{p.title}</p>
                      {p.platforms?.length ? (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {p.platforms.map((pl) => (
                            <span key={pl} className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                              {pl}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <aside className="space-y-4">
          <div className="bg-card border border-border rounded-lg shadow-sm">
            <header className="px-5 py-3.5 border-b border-border">
              <h2 className="font-semibold text-sm">Upcoming · next 7 days</h2>
            </header>
            {upcoming.length === 0 ? (
              <div className="px-5 py-6 text-xs text-muted-foreground text-center">All clear for the next 7 days.</div>
            ) : (
              <ul className="divide-y divide-border">
                {upcoming.map((p) => (
                  <li key={p.id} className="px-5 py-2.5">
                    <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
                      {formatDistanceToNow(p.scheduledFor, { addSuffix: true })}
                    </div>
                    <div className="text-sm truncate mt-0.5">{p.title}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="bg-card border border-border rounded-lg shadow-sm">
            <header className="px-5 py-3.5 border-b border-border">
              <h2 className="font-semibold text-sm">Account progress</h2>
            </header>
            <div className="p-4 space-y-3">
              {accounts.map((a) => {
                const meta = ACCOUNT_META[a.slug as AccountSlug] ?? { name: a.name, color: a.color }
                const stats = perAcc.get(a.id) ?? { total: 0, pub: 0 }
                const apct = stats.total ? Math.round((stats.pub / stats.total) * 100) : 0
                return (
                  <div key={a.id}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-semibold" style={{ color: meta.color }}>{meta.name}</span>
                      <span className="text-muted-foreground">{stats.pub} / {stats.total}</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${apct}%`, background: meta.color }} />
                    </div>
                  </div>
                )
              })}
              {accounts.length === 0 ? (
                <p className="text-xs text-muted-foreground">No accounts yet — run the seed script.</p>
              ) : null}
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}

function KpiCard({ label, value, hint, accent }: { label: string; value: number | string; hint?: string; accent?: string }) {
  return (
    <div className="bg-card border border-border rounded-lg shadow-sm p-4">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${accent ?? ''}`}>{value}</div>
      {hint ? <div className="text-xs text-muted-foreground mt-1">{hint}</div> : null}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="bg-card border border-border rounded-lg shadow-sm py-16 px-6 text-center">
      <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 mb-4">
        <Megaphone className="h-6 w-6 text-primary" />
      </div>
      <h2 className="font-display text-xl font-semibold tracking-tight">Marketing OS is empty</h2>
      <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
        Run the seed script to import the existing N5Deal · BankStore · Ihor · Denys content plan
        (~150 posts), or start adding posts manually from the calendar.
      </p>
      <div className="mt-6 flex items-center justify-center gap-2">
        <Button asChild>
          <Link href="/marketing/calendar" className="gap-1.5">
            <Plus className="h-4 w-4" /> Open calendar
          </Link>
        </Button>
      </div>
      <div className="mt-8 inline-flex items-center gap-1.5 text-xs text-muted-foreground bg-muted px-3 py-1.5 rounded">
        <Sparkles className="h-3 w-3" />
        <code className="font-mono">npx tsx --require dotenv/config scripts/seed-marketing-os.ts</code>
      </div>
    </div>
  )
}
