'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { addDays, format, startOfWeek } from 'date-fns'
import { ChevronLeft, ChevronRight, CalendarDays, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { WeekView } from './week-view'
import { MonthView } from './month-view'
import { ListView } from './list-view'
import { BoardView } from './board-view'
import { PostFormModal } from './post-form-modal'
import type { CalAccount, CalPost } from './types'

type View = 'week' | 'month' | 'list' | 'board'

type Mode =
  | { kind: 'create'; defaultDate: string; defaultAccountId?: string }
  | { kind: 'edit'; post: CalPost }
  | null

const VIEWS: { v: View; label: string }[] = [
  { v: 'week', label: 'Week' },
  { v: 'month', label: 'Month' },
  { v: 'list', label: 'List' },
  { v: 'board', label: 'Board' },
]

export function CalendarBoard({
  accounts,
  posts,
  weekStartISO,
  anchorISO,
  initialView,
}: {
  accounts: CalAccount[]
  posts: CalPost[]
  weekStartISO: string
  anchorISO: string
  initialView: View
}) {
  const router = useRouter()
  const params = useSearchParams()
  const [view, setView] = useState<View>(initialView)
  const [mode, setMode] = useState<Mode>(null)

  const weekStart = new Date(weekStartISO)
  const anchor = new Date(anchorISO)

  function pushQuery(updates: Record<string, string | undefined>) {
    const q = new URLSearchParams(params.toString())
    for (const [k, v] of Object.entries(updates)) {
      if (v === undefined) q.delete(k)
      else q.set(k, v)
    }
    router.push('/marketing/calendar?' + q.toString())
  }

  function changeView(v: View) {
    setView(v)
    pushQuery({ view: v })
  }

  function shift(deltaDays: number) {
    const next = addDays(anchor, deltaDays)
    pushQuery({ week: next.toISOString().slice(0, 10) })
  }

  function gotoToday() {
    pushQuery({ week: undefined })
  }

  function openCreate(defaultDateISO: string, defaultAccountId?: string) {
    setMode({ kind: 'create', defaultDate: defaultDateISO.slice(0, 10), defaultAccountId })
  }

  function openEdit(post: CalPost) {
    setMode({ kind: 'edit', post })
  }

  const headerLabel =
    view === 'week'
      ? `${format(weekStart, 'd LLL')} – ${format(addDays(weekStart, 6), 'd LLL yyyy')}`
      : view === 'month'
      ? format(anchor, 'LLLL yyyy')
      : format(anchor, 'LLLL yyyy')

  const shiftBy = view === 'week' ? 7 : 30

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Button variant="outline" size="icon" onClick={() => shift(-shiftBy)} aria-label="Previous">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="font-semibold text-sm tabular-nums min-w-[180px]">{headerLabel}</div>
        <Button variant="outline" size="icon" onClick={() => shift(shiftBy)} aria-label="Next">
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={gotoToday}>
          <CalendarDays className="h-3.5 w-3.5 mr-1.5" /> Today
        </Button>

        <div className="ml-auto flex items-center gap-2">
          <div className="inline-flex p-0.5 bg-muted rounded-md border border-border">
            {VIEWS.map((v) => (
              <button
                key={v.v}
                onClick={() => changeView(v.v)}
                className={cn(
                  'px-2.5 py-1 text-xs font-semibold rounded-sm transition-colors',
                  view === v.v ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {v.label}
              </button>
            ))}
          </div>
          <Button
            onClick={() =>
              openCreate(new Date().toISOString(), accounts[0]?.id)
            }
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Add post
          </Button>
        </div>
      </div>

      {accounts.length === 0 ? (
        <EmptyAccounts />
      ) : (
        <>
          {view === 'week' && (
            <WeekView
              accounts={accounts}
              posts={posts}
              weekStart={startOfWeek(anchor, { weekStartsOn: 1 })}
              onCellClick={(dateISO, accountId) => openCreate(dateISO, accountId)}
              onPostClick={openEdit}
            />
          )}
          {view === 'month' && (
            <MonthView
              accounts={accounts}
              posts={posts}
              anchor={anchor}
              onCellClick={(dateISO) => openCreate(dateISO)}
              onPostClick={openEdit}
            />
          )}
          {view === 'list' && <ListView accounts={accounts} posts={posts} onPostClick={openEdit} />}
          {view === 'board' && (
            <BoardView accounts={accounts} posts={posts} onPostClick={openEdit} />
          )}
        </>
      )}

      <PostFormModal accounts={accounts} mode={mode} onClose={() => setMode(null)} />
    </div>
  )
}

function EmptyAccounts() {
  return (
    <div className="rounded-lg border border-dashed border-border bg-card py-16 px-6 text-center">
      <p className="text-sm font-medium">No social accounts in this workspace yet.</p>
      <code className="inline-block mt-3 text-[11px] font-mono bg-muted px-2.5 py-1 rounded">
        npx tsx --require dotenv/config scripts/seed-marketing-os.ts
      </code>
    </div>
  )
}
