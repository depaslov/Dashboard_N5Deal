'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { addDays, format, isSameDay } from 'date-fns'
import { ChevronLeft, ChevronRight, CalendarDays, Image as ImageIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ACCOUNT_META, ACCOUNT_BADGE, ACCOUNT_ACCENT, type AccountSlug } from '@/lib/marketing/constants'
import { cn } from '@/lib/utils'

interface Account {
  id: string
  slug: string
  name: string
  color: string
}

interface Post {
  id: string
  accountId: string
  accountSlug: string
  type: string
  title: string
  platforms: string[]
  scheduledFor: string
  status: string
  imageCount: number
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export function CalendarWeek({
  accounts,
  posts,
  weekStartISO,
}: {
  accounts: Account[]
  posts: Post[]
  weekStartISO: string
}) {
  const router = useRouter()
  const params = useSearchParams()
  const weekStart = new Date(weekStartISO)
  const today = new Date(); today.setHours(0, 0, 0, 0)

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const weekEnd = addDays(weekStart, 6)

  function goWeek(deltaDays: number) {
    const next = addDays(weekStart, deltaDays)
    const q = new URLSearchParams(params.toString())
    q.set('week', next.toISOString().slice(0, 10))
    router.push('/marketing/calendar?' + q.toString())
  }

  function postsForCell(accountId: string, day: Date) {
    return posts.filter((p) => p.accountId === accountId && isSameDay(new Date(p.scheduledFor), day))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="outline" size="icon" onClick={() => goWeek(-7)} aria-label="Previous week">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="font-semibold text-sm tabular-nums">
          {format(weekStart, 'd LLL')} – {format(weekEnd, 'd LLL yyyy')}
        </div>
        <Button variant="outline" size="icon" onClick={() => goWeek(7)} aria-label="Next week">
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={() => router.push('/marketing/calendar')}>
          <CalendarDays className="h-3.5 w-3.5 mr-1.5" /> This week
        </Button>
      </div>

      {accounts.length === 0 ? (
        <EmptyAccounts />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-sm">
          <div className="grid min-w-[1100px]" style={{ gridTemplateColumns: '120px repeat(7, minmax(0,1fr))' }}>
            {/* Header row */}
            <div className="bg-muted/50 border-b border-r border-border" />
            {days.map((d, i) => {
              const isTod = isSameDay(d, today)
              return (
                <div
                  key={i}
                  className={cn(
                    'bg-muted/50 border-b border-border text-center py-2.5 px-2',
                    isTod && 'bg-primary/10',
                    i < 6 && 'border-r',
                  )}
                >
                  <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    {WEEKDAYS[i]}
                  </div>
                  <div className={cn('text-lg font-bold tabular-nums', isTod && 'text-primary')}>
                    {d.getDate()}
                  </div>
                </div>
              )
            })}

            {/* One row per account */}
            {accounts.map((a, rowIdx) => {
              const meta = ACCOUNT_META[a.slug as AccountSlug]
              const isLast = rowIdx === accounts.length - 1
              return (
                <div key={a.id} className="contents">
                  <div
                    className={cn(
                      'border-r border-border px-3 py-3 flex items-start',
                      !isLast && 'border-b',
                    )}
                  >
                    <Badge
                      variant="secondary"
                      className={cn('font-semibold text-[10px] uppercase tracking-widest', ACCOUNT_BADGE[a.slug as AccountSlug])}
                    >
                      {meta?.name ?? a.name}
                    </Badge>
                  </div>
                  {days.map((d, i) => {
                    const cellPosts = postsForCell(a.id, d)
                    const isLastCol = i === 6
                    return (
                      <div
                        key={i}
                        className={cn(
                          'p-1.5 min-h-[90px] space-y-1',
                          !isLast && 'border-b border-border',
                          !isLastCol && 'border-r border-border',
                        )}
                      >
                        {cellPosts.map((p) => (
                          <PostCard key={p.id} post={p} slug={a.slug as AccountSlug} />
                        ))}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function PostCard({ post, slug }: { post: Post; slug: AccountSlug }) {
  const isArticle = post.type === 'Article'
  const isPublished = post.status === 'pub'
  return (
    <Link
      href={`/marketing/posts/${post.id}`}
      className={cn(
        'block bg-card hover:bg-accent/50 border border-border border-l-2 rounded p-1.5 text-xs leading-tight transition-colors relative',
        isArticle ? 'border-l-amber-600' : ACCOUNT_ACCENT[slug],
        isPublished && 'opacity-60',
      )}
    >
      <div className="flex items-center gap-1 mb-0.5">
        <span
          className={cn(
            'text-[9px] font-bold uppercase tracking-wider px-1 py-0.5 rounded',
            isArticle ? 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300' : ACCOUNT_BADGE[slug],
          )}
        >
          {post.type}
        </span>
        {post.imageCount > 0 ? (
          <span className="inline-flex items-center gap-0.5 text-[9px] text-muted-foreground">
            <ImageIcon className="h-2.5 w-2.5" />
            {post.imageCount > 1 ? post.imageCount : ''}
          </span>
        ) : null}
        {post.status !== 'idea' ? (
          <span
            className={cn(
              'ml-auto h-1.5 w-1.5 rounded-full',
              post.status === 'wip' && 'bg-blue-500',
              post.status === 'done' && 'bg-emerald-500',
              post.status === 'pub' && 'bg-amber-500',
              post.status === 'skip' && 'bg-red-500',
            )}
          />
        ) : null}
      </div>
      <div className="line-clamp-3 text-[11px]">{post.title}</div>
      {post.platforms?.length ? (
        <div className="mt-1 flex flex-wrap gap-0.5">
          {post.platforms.slice(0, 3).map((pl) => (
            <span key={pl} className="text-[8px] font-medium px-1 py-0.5 rounded bg-muted text-muted-foreground">
              {pl}
            </span>
          ))}
        </div>
      ) : null}
    </Link>
  )
}

function EmptyAccounts() {
  return (
    <div className="rounded-lg border border-dashed border-border bg-card py-16 px-6 text-center">
      <p className="text-sm font-medium">No social accounts in this workspace yet.</p>
      <p className="text-xs text-muted-foreground mt-2">
        Seed the four default accounts (N5Deal, BankStore, Ihor Vlasov, Denys Bets) with:
      </p>
      <code className="inline-block mt-3 text-[11px] font-mono bg-muted px-2.5 py-1 rounded">
        npx tsx --require dotenv/config scripts/seed-marketing-os.ts
      </code>
    </div>
  )
}
