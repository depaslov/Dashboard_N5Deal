'use client'

import { format, startOfWeek } from 'date-fns'
import { ACCOUNT_BADGE, ACCOUNT_META, POST_STATUS_LABEL, type AccountSlug } from '@/lib/marketing/constants'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { CalAccount, CalPost } from './types'

export function ListView({
  accounts,
  posts,
  onPostClick,
}: {
  accounts: CalAccount[]
  posts: CalPost[]
  onPostClick: (post: CalPost) => void
}) {
  const accBySlug = Object.fromEntries(accounts.map((a) => [a.id, a]))

  if (posts.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card py-12 text-center text-sm text-muted-foreground">
        No posts in this window.
      </div>
    )
  }

  // Group by week
  const groups = new Map<string, CalPost[]>()
  for (const p of posts) {
    const ws = startOfWeek(new Date(p.scheduledFor), { weekStartsOn: 1 })
    const key = ws.toISOString()
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(p)
  }
  const sorted = [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))

  return (
    <div className="rounded-lg border border-border bg-card shadow-sm overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            <th className="text-left px-4 py-2.5">Date</th>
            <th className="text-left px-4 py-2.5">Account</th>
            <th className="text-left px-4 py-2.5">Type</th>
            <th className="text-left px-4 py-2.5">Title</th>
            <th className="text-left px-4 py-2.5">Platforms</th>
            <th className="text-left px-4 py-2.5">Status</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(([weekISO, ps]) => (
            <RowGroup
              key={weekISO}
              weekISO={weekISO}
              posts={ps}
              accBySlug={accBySlug}
              onPostClick={onPostClick}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function RowGroup({
  weekISO,
  posts,
  accBySlug,
  onPostClick,
}: {
  weekISO: string
  posts: CalPost[]
  accBySlug: Record<string, CalAccount>
  onPostClick: (post: CalPost) => void
}) {
  const ws = new Date(weekISO)
  const sorted = [...posts].sort(
    (a, b) => new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime(),
  )
  return (
    <>
      <tr className="bg-muted/30">
        <td colSpan={6} className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          Week of {format(ws, 'd LLL yyyy')}
        </td>
      </tr>
      {sorted.map((p) => {
        const acc = accBySlug[p.accountId]
        const slug = (acc?.slug ?? 'n5') as AccountSlug
        const meta = ACCOUNT_META[slug] ?? { name: acc?.name ?? '—', color: acc?.color ?? '' }
        return (
          <tr
            key={p.id}
            onClick={() => onPostClick(p)}
            className="border-b border-border last:border-b-0 cursor-pointer hover:bg-accent/30 transition-colors"
          >
            <td className="px-4 py-2.5 text-xs whitespace-nowrap text-muted-foreground tabular-nums">
              {format(new Date(p.scheduledFor), 'EEE d LLL')}
            </td>
            <td className="px-4 py-2.5 text-xs font-semibold" style={{ color: meta.color }}>
              {meta.name}
            </td>
            <td className="px-4 py-2.5">
              <Badge
                variant="secondary"
                className={cn(
                  'text-[10px]',
                  p.type === 'Article'
                    ? 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300'
                    : ACCOUNT_BADGE[slug],
                )}
              >
                {p.type}
              </Badge>
            </td>
            <td className="px-4 py-2.5 text-sm max-w-md truncate">{p.title}</td>
            <td className="px-4 py-2.5">
              <div className="flex flex-wrap gap-1">
                {p.platforms.map((pl) => (
                  <span
                    key={pl}
                    className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground"
                  >
                    {pl}
                  </span>
                ))}
              </div>
            </td>
            <td className="px-4 py-2.5">
              <StatusDot status={p.status} />
            </td>
          </tr>
        )
      })}
    </>
  )
}

function StatusDot({ status }: { status: string }) {
  const color =
    status === 'pub'
      ? 'bg-amber-500'
      : status === 'done'
      ? 'bg-emerald-500'
      : status === 'wip'
      ? 'bg-blue-500'
      : status === 'skip'
      ? 'bg-red-500'
      : 'bg-slate-400'
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className={cn('h-1.5 w-1.5 rounded-full', color)} />
      {POST_STATUS_LABEL[status as keyof typeof POST_STATUS_LABEL] ?? status}
    </span>
  )
}
