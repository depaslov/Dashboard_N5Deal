'use client'

import { useState } from 'react'
import { endOfMonth, isSameDay, isSameMonth, startOfMonth } from 'date-fns'
import { Plus } from 'lucide-react'
import { ACCOUNT_BADGE, type AccountSlug } from '@/lib/marketing/constants'
import { cn } from '@/lib/utils'
import type { CalAccount, CalPost } from './types'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MAX_CHIPS_PER_DAY = 4

export function MonthView({
  accounts,
  posts,
  anchor,
  onCellClick,
  onPostClick,
  onReschedule,
}: {
  accounts: CalAccount[]
  posts: CalPost[]
  anchor: Date
  onCellClick: (dateISO: string) => void
  onPostClick: (post: CalPost) => void
  onReschedule: (postId: string, dateISO: string) => void
}) {
  const [dragOverKey, setDragOverKey] = useState<string | null>(null)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const monthStart = startOfMonth(anchor)
  const monthEnd = endOfMonth(anchor)

  // Calculate calendar grid (start from Monday of week containing monthStart)
  const gridStart = new Date(monthStart)
  const offset = (gridStart.getDay() + 6) % 7
  gridStart.setDate(gridStart.getDate() - offset)
  const totalCells = Math.ceil((offset + monthEnd.getDate()) / 7) * 7

  const cells: Date[] = []
  for (let i = 0; i < totalCells; i++) {
    const d = new Date(gridStart)
    d.setDate(d.getDate() + i)
    d.setHours(0, 0, 0, 0)
    cells.push(d)
  }

  const accBySlug = Object.fromEntries(accounts.map((a) => [a.id, a]))

  function postsForDay(day: Date) {
    return posts.filter((p) => isSameDay(new Date(p.scheduledFor), day))
  }

  return (
    <div className="rounded-lg border border-border bg-card shadow-sm overflow-hidden">
      <div className="grid grid-cols-7">
        {WEEKDAYS.map((d) => (
          <div
            key={d}
            className="bg-muted/50 border-b border-border text-center py-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground"
          >
            {d}
          </div>
        ))}
        {cells.map((d, i) => {
          const inMonth = isSameMonth(d, anchor)
          const isTod = isSameDay(d, today)
          const dayPosts = postsForDay(d)
          const cellKey = d.toISOString().slice(0, 10)
          const isDropTarget = dragOverKey === cellKey
          return (
            <div
              key={i}
              onClick={() => onCellClick(d.toISOString())}
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
                'min-h-[110px] p-1.5 border-r border-b border-border last:border-r-0 cursor-pointer group/cell relative transition-colors',
                !inMonth && 'bg-muted/30 text-muted-foreground/60',
                isTod && 'bg-primary/5',
                isDropTarget && 'bg-primary/10 ring-1 ring-inset ring-primary',
                (i + 1) % 7 === 0 && 'border-r-0',
                i >= cells.length - 7 && 'border-b-0',
              )}
            >
              <div className="flex items-center justify-between mb-1">
                <span
                  className={cn(
                    'text-xs font-bold inline-flex items-center justify-center w-5 h-5 rounded-full tabular-nums',
                    isTod && 'bg-primary text-primary-foreground',
                  )}
                >
                  {d.getDate()}
                </span>
                <Plus className="h-3 w-3 opacity-0 group-hover/cell:opacity-60 text-muted-foreground" />
              </div>
              <div className="space-y-0.5">
                {dayPosts.slice(0, MAX_CHIPS_PER_DAY).map((p) => {
                  const slug = (accBySlug[p.accountId]?.slug ?? 'n5') as AccountSlug
                  return (
                    <button
                      type="button"
                      key={p.id}
                      onClick={(e) => {
                        e.stopPropagation()
                        onPostClick(p)
                      }}
                      draggable
                      onDragStart={(e) => {
                        e.stopPropagation()
                        e.dataTransfer.effectAllowed = 'move'
                        e.dataTransfer.setData('text/post-id', p.id)
                      }}
                      className={cn(
                        'block w-full text-left text-[10px] font-medium px-1.5 py-0.5 rounded truncate cursor-grab active:cursor-grabbing',
                        p.type === 'Article'
                          ? 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300'
                          : ACCOUNT_BADGE[slug],
                      )}
                      title={p.title}
                    >
                      {p.title}
                    </button>
                  )
                })}
                {dayPosts.length > MAX_CHIPS_PER_DAY ? (
                  <div className="text-[10px] text-muted-foreground font-semibold pl-1">
                    +{dayPosts.length - MAX_CHIPS_PER_DAY} more
                  </div>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
