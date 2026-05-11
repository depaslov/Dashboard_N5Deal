'use client'

import { useState } from 'react'
import { addDays, isSameDay } from 'date-fns'
import { Plus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { ACCOUNT_BADGE, ACCOUNT_META, type AccountSlug } from '@/lib/marketing/constants'
import { cn } from '@/lib/utils'
import { PostCard } from './post-card'
import type { CalAccount, CalPost } from './types'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export function WeekView({
  accounts,
  posts,
  weekStart,
  onCellClick,
  onPostClick,
  onReschedule,
}: {
  accounts: CalAccount[]
  posts: CalPost[]
  weekStart: Date
  onCellClick: (dateISO: string, accountId: string) => void
  onPostClick: (post: CalPost) => void
  onReschedule: (postId: string, dateISO: string) => void
}) {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const [dragOverKey, setDragOverKey] = useState<string | null>(null)

  function postsForCell(accountId: string, day: Date) {
    return posts.filter(
      (p) => p.accountId === accountId && isSameDay(new Date(p.scheduledFor), day),
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-sm">
      <div className="grid min-w-[1100px]" style={{ gridTemplateColumns: '120px repeat(7, minmax(0,1fr))' }}>
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
              <div className={cn('text-lg font-bold tabular-nums', isTod && 'text-primary')}>{d.getDate()}</div>
            </div>
          )
        })}

        {accounts.map((a, rowIdx) => {
          const meta = ACCOUNT_META[a.slug as AccountSlug]
          const isLast = rowIdx === accounts.length - 1
          return (
            <div key={a.id} className="contents">
              <div className={cn('border-r border-border px-3 py-3 flex items-start', !isLast && 'border-b')}>
                <Badge
                  variant="secondary"
                  className={cn(
                    'font-semibold text-[10px] uppercase tracking-widest',
                    ACCOUNT_BADGE[a.slug as AccountSlug],
                  )}
                >
                  {meta?.name ?? a.name}
                </Badge>
              </div>
              {days.map((d, i) => {
                const cellPosts = postsForCell(a.id, d)
                const isLastCol = i === 6
                const cellKey = `${a.id}-${d.toISOString().slice(0, 10)}`
                const isDropTarget = dragOverKey === cellKey
                return (
                  <div
                    key={i}
                    onDragOver={(e) => {
                      e.preventDefault()
                      e.dataTransfer.dropEffect = 'move'
                      if (dragOverKey !== cellKey) setDragOverKey(cellKey)
                    }}
                    onDragLeave={() => setDragOverKey((k) => (k === cellKey ? null : k))}
                    onDrop={(e) => {
                      e.preventDefault()
                      setDragOverKey(null)
                      const id = e.dataTransfer.getData('text/post-id')
                      if (id) onReschedule(id, d.toISOString())
                    }}
                    className={cn(
                      'p-1.5 min-h-[90px] space-y-1 group/cell relative transition-colors',
                      !isLast && 'border-b border-border',
                      !isLastCol && 'border-r border-border',
                      isDropTarget && 'bg-primary/10 ring-1 ring-inset ring-primary',
                    )}
                  >
                    {cellPosts.map((p) => (
                      <PostCard
                        key={p.id}
                        post={p}
                        slug={a.slug as AccountSlug}
                        onClick={() => onPostClick(p)}
                        draggable
                      />
                    ))}
                    <button
                      type="button"
                      onClick={() => onCellClick(d.toISOString(), a.id)}
                      className={cn(
                        'w-full rounded border border-dashed border-border text-muted-foreground/60 hover:text-primary hover:border-primary hover:bg-primary/5 transition-colors flex items-center justify-center',
                        cellPosts.length === 0 ? 'min-h-[60px]' : 'min-h-[20px] opacity-0 group-hover/cell:opacity-100',
                      )}
                      aria-label="Add post"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}
