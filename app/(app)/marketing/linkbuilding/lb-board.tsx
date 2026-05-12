'use client'

import { useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { format, isSameDay, isSameMonth, startOfMonth, endOfMonth } from 'date-fns'
import { toast } from 'sonner'
import {
  CalendarDays, List as ListIcon, Layers, Plus, ChevronLeft, ChevronRight, Link2, ExternalLink,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  LB_STATUSES, LB_STATUS_BADGE, LB_TYPES, type LBStatus, type LBType,
} from '@/lib/marketing/constants'
import { cn } from '@/lib/utils'
import { LbFormModal } from './lb-form-modal'

export interface LbItem {
  id: string
  title: string
  targetSite: string
  contactName: string
  contactEmail: string
  anchorText: string
  destinationUrl: string
  type: string
  status: string
  scheduledFor: string
  publishedDate: string | null
  liveUrl: string
  dr: number | null
  cost: number | null
  notes: string
}

type View = 'list' | 'calendar' | 'board'
const VIEWS: { v: View; label: string; icon: typeof ListIcon }[] = [
  { v: 'list', label: 'List', icon: ListIcon },
  { v: 'calendar', label: 'Calendar', icon: CalendarDays },
  { v: 'board', label: 'Board', icon: Layers },
]

type Mode = { kind: 'create'; defaultDate?: string } | { kind: 'edit'; item: LbItem } | null

export function LinkBuildingBoard({
  items,
  initialView,
  anchorMonthISO,
}: {
  items: LbItem[]
  initialView: View
  anchorMonthISO: string
}) {
  const router = useRouter()
  const params = useSearchParams()
  const [view, setView] = useState<View>(initialView)
  const [mode, setMode] = useState<Mode>(null)
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const anchor = new Date(anchorMonthISO)

  function pushQuery(updates: Record<string, string | undefined>) {
    const q = new URLSearchParams(params.toString())
    for (const [k, v] of Object.entries(updates)) {
      if (v === undefined) q.delete(k); else q.set(k, v)
    }
    router.push('/marketing/linkbuilding?' + q.toString())
  }

  function changeView(v: View) {
    setView(v)
    pushQuery({ view: v })
  }

  function shiftMonth(d: number) {
    const next = new Date(anchor)
    next.setMonth(next.getMonth() + d)
    pushQuery({ month: next.toISOString() })
  }

  const filtered = useMemo(
    () => (statusFilter === 'all' ? items : items.filter((i) => i.status === statusFilter)),
    [items, statusFilter],
  )

  const summary = useMemo(() => {
    const s = { total: items.length, published: 0, in_progress: 0, planned: 0, declined: 0, followup: 0, totalCost: 0 }
    for (const i of items) {
      if (i.status === 'published') s.published++
      if (i.status === 'in_progress') s.in_progress++
      if (i.status === 'planned') s.planned++
      if (i.status === 'declined') s.declined++
      if (i.status === 'followup') s.followup++
      if (typeof i.cost === 'number') s.totalCost += i.cost
    }
    return s
  }, [items])

  // % of attempted (published / attempted) where attempted = everything not 'planned'
  const conversionRate = useMemo(() => {
    const attempted = items.filter((i) => i.status !== 'planned').length
    if (!attempted) return null
    return Math.round((summary.published / attempted) * 100)
  }, [items, summary.published])

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-6">
        <KpiCard label="Total" value={summary.total} />
        <KpiCard label="Published" value={summary.published} accent="text-emerald-600" />
        <KpiCard label="In progress" value={summary.in_progress} accent="text-blue-600" />
        <KpiCard label="Follow-up" value={summary.followup} accent="text-amber-600" />
        <KpiCard label="Conversion" value={conversionRate !== null ? `${conversionRate}%` : '—'} hint="published / attempted" />
        <KpiCard label="Spend" value={`$${summary.totalCost.toLocaleString()}`} />
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="inline-flex p-0.5 bg-muted rounded-md border border-border">
          {VIEWS.map((v) => (
            <button
              key={v.v}
              onClick={() => changeView(v.v)}
              className={cn(
                'inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-sm transition-colors',
                view === v.v ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <v.icon className="h-3.5 w-3.5" /> {v.label}
            </button>
          ))}
        </div>

        {/* Status filter pills */}
        <div className="flex items-center gap-1 flex-wrap">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={cn(
              'text-xs font-semibold px-2.5 py-1 rounded-full border transition-colors',
              statusFilter === 'all' ? 'border-foreground bg-foreground text-background' : 'border-border bg-card text-muted-foreground hover:bg-accent',
            )}
          >
            All
          </button>
          {LB_STATUSES.map((s) => (
            <button
              key={s.k}
              type="button"
              onClick={() => setStatusFilter(s.k)}
              className={cn(
                'inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border transition-colors',
                statusFilter === s.k ? LB_STATUS_BADGE[s.k as LBStatus] + ' border-transparent' : 'border-border bg-card text-muted-foreground hover:bg-accent',
              )}
            >
              <span className={cn('h-1.5 w-1.5 rounded-full', s.dot)} />
              {s.label}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          {view === 'calendar' ? (
            <>
              <Button variant="outline" size="icon" onClick={() => shiftMonth(-1)} aria-label="Previous month">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="text-sm font-semibold tabular-nums min-w-[120px] text-center">{format(anchor, 'LLLL yyyy')}</div>
              <Button variant="outline" size="icon" onClick={() => shiftMonth(1)} aria-label="Next month">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </>
          ) : null}
          <Button onClick={() => setMode({ kind: 'create' })}>
            <Plus className="h-4 w-4 mr-1.5" /> Add link
          </Button>
        </div>
      </div>

      {/* Views */}
      {items.length === 0 ? (
        <EmptyState onAdd={() => setMode({ kind: 'create' })} />
      ) : (
        <>
          {view === 'list' && <ListView items={filtered} onClick={(it) => setMode({ kind: 'edit', item: it })} />}
          {view === 'calendar' && (
            <CalendarView
              items={filtered}
              anchor={anchor}
              onClickItem={(it) => setMode({ kind: 'edit', item: it })}
              onClickCell={(d) => setMode({ kind: 'create', defaultDate: d.toISOString() })}
            />
          )}
          {view === 'board' && <BoardView items={filtered} onClick={(it) => setMode({ kind: 'edit', item: it })} />}
        </>
      )}

      <LbFormModal mode={mode} onClose={() => setMode(null)} />
    </div>
  )
}

function KpiCard({ label, value, hint, accent }: { label: string; value: number | string; hint?: string; accent?: string }) {
  return (
    <div className="bg-card border border-border rounded-lg p-3">
      <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={cn('text-xl font-bold mt-1 tabular-nums', accent)}>{value}</div>
      {hint ? <div className="text-[10px] text-muted-foreground mt-0.5">{hint}</div> : null}
    </div>
  )
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-card py-16 px-6 text-center">
      <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 mb-4">
        <Link2 className="h-6 w-6 text-primary" />
      </div>
      <h3 className="font-semibold">No link building activity yet</h3>
      <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
        Track every outreach, guest post, resource-page pitch, and partner placement. Calendar
        shows what's planned, the board shows status, the list is the master record.
      </p>
      <Button className="mt-4" onClick={onAdd}>
        <Plus className="h-4 w-4 mr-1.5" /> Add your first item
      </Button>
    </div>
  )
}

// ============================================================================
// List view
// ============================================================================
function ListView({ items, onClick }: { items: LbItem[]; onClick: (i: LbItem) => void }) {
  if (items.length === 0) return <FilteredEmpty />
  return (
    <div className="rounded-lg border border-border bg-card shadow-sm overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            <th className="text-left px-4 py-2.5">Scheduled</th>
            <th className="text-left px-4 py-2.5">Title / Site</th>
            <th className="text-left px-4 py-2.5">Type</th>
            <th className="text-left px-4 py-2.5">Status</th>
            <th className="text-right px-4 py-2.5">DR</th>
            <th className="text-right px-4 py-2.5">Cost</th>
            <th className="text-left px-4 py-2.5">Live URL</th>
          </tr>
        </thead>
        <tbody>
          {items.map((i) => {
            const typeMeta = LB_TYPES.find((t) => t.k === i.type)
            return (
              <tr
                key={i.id}
                onClick={() => onClick(i)}
                className="border-b border-border last:border-b-0 cursor-pointer hover:bg-accent/30 transition-colors"
              >
                <td className="px-4 py-2.5 text-xs whitespace-nowrap text-muted-foreground tabular-nums">
                  {format(new Date(i.scheduledFor), 'd LLL yyyy')}
                </td>
                <td className="px-4 py-2.5">
                  <div className="font-medium truncate max-w-md">{i.title}</div>
                  {i.targetSite ? <div className="text-[11px] text-muted-foreground mt-0.5 truncate max-w-md">{i.targetSite}</div> : null}
                </td>
                <td className="px-4 py-2.5">
                  <Badge variant="secondary" className="text-[10px]">{typeMeta?.label ?? i.type}</Badge>
                </td>
                <td className="px-4 py-2.5">
                  <Badge variant="secondary" className={cn('text-[10px]', LB_STATUS_BADGE[i.status as LBStatus] ?? '')}>
                    {LB_STATUSES.find((s) => s.k === i.status)?.label ?? i.status}
                  </Badge>
                </td>
                <td className="px-4 py-2.5 text-right text-xs tabular-nums text-muted-foreground">{i.dr ?? '—'}</td>
                <td className="px-4 py-2.5 text-right text-xs tabular-nums text-muted-foreground">
                  {typeof i.cost === 'number' ? `$${i.cost.toLocaleString()}` : '—'}
                </td>
                <td className="px-4 py-2.5">
                  {i.liveUrl ? (
                    <a
                      href={i.liveUrl}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-xs text-primary inline-flex items-center gap-1 truncate max-w-[180px]"
                    >
                      <ExternalLink className="h-3 w-3" />
                      <span className="truncate">{i.liveUrl.replace(/^https?:\/\//, '')}</span>
                    </a>
                  ) : (
                    <span className="text-xs text-muted-foreground italic">—</span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ============================================================================
// Calendar (month) view
// ============================================================================
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MAX_CHIPS = 4

function CalendarView({
  items,
  anchor,
  onClickItem,
  onClickCell,
}: {
  items: LbItem[]
  anchor: Date
  onClickItem: (i: LbItem) => void
  onClickCell: (d: Date) => void
}) {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const monthStart = startOfMonth(anchor)
  const monthEnd = endOfMonth(anchor)
  const gridStart = new Date(monthStart)
  const offset = (gridStart.getDay() + 6) % 7
  gridStart.setDate(gridStart.getDate() - offset)
  const totalCells = Math.ceil((offset + monthEnd.getDate()) / 7) * 7
  const cells: Date[] = []
  for (let i = 0; i < totalCells; i++) {
    const d = new Date(gridStart); d.setDate(d.getDate() + i); d.setHours(0, 0, 0, 0)
    cells.push(d)
  }

  function itemsForDay(d: Date) {
    return items.filter((it) => isSameDay(new Date(it.scheduledFor), d))
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
          const dayItems = itemsForDay(d)
          return (
            <div
              key={i}
              onClick={() => onClickCell(d)}
              className={cn(
                'min-h-[110px] p-1.5 border-r border-b border-border last:border-r-0 cursor-pointer group/cell relative transition-colors',
                !inMonth && 'bg-muted/30 text-muted-foreground/60',
                isTod && 'bg-primary/5',
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
                {dayItems.slice(0, MAX_CHIPS).map((it) => (
                  <button
                    type="button"
                    key={it.id}
                    onClick={(e) => { e.stopPropagation(); onClickItem(it) }}
                    title={`${it.title} · ${it.targetSite || ''}`}
                    className={cn(
                      'block w-full text-left text-[10px] font-medium px-1.5 py-0.5 rounded truncate',
                      LB_STATUS_BADGE[it.status as LBStatus] ?? 'bg-muted text-muted-foreground',
                    )}
                  >
                    {it.title}
                  </button>
                ))}
                {dayItems.length > MAX_CHIPS ? (
                  <div className="text-[10px] text-muted-foreground font-semibold pl-1">
                    +{dayItems.length - MAX_CHIPS} more
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

// ============================================================================
// Board (kanban by status)
// ============================================================================
function BoardView({ items, onClick }: { items: LbItem[]; onClick: (i: LbItem) => void }) {
  if (items.length === 0) return <FilteredEmpty />
  return (
    <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
      {LB_STATUSES.map((s) => {
        const cards = items.filter((i) => i.status === s.k)
        return (
          <div key={s.k} className="bg-muted/30 border border-border rounded-lg p-3">
            <header className="flex items-center gap-2 mb-3 px-1">
              <span className={cn('h-2 w-2 rounded-full', s.dot)} />
              <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{s.label}</h3>
              <span className="ml-auto text-[10px] bg-card border border-border px-1.5 py-0.5 rounded text-muted-foreground font-medium">
                {cards.length}
              </span>
            </header>
            <div className="space-y-1.5">
              {cards.map((i) => (
                <button
                  key={i.id}
                  type="button"
                  onClick={() => onClick(i)}
                  className="w-full text-left bg-card border border-border rounded p-2.5 hover:bg-accent/50 transition-colors"
                >
                  <div className="text-xs font-medium line-clamp-2">{i.title}</div>
                  {i.targetSite ? (
                    <div className="text-[10px] text-muted-foreground mt-1 truncate">{i.targetSite}</div>
                  ) : null}
                  <div className="flex items-center gap-2 mt-1.5 text-[10px] text-muted-foreground tabular-nums">
                    <span>{format(new Date(i.scheduledFor), 'd LLL')}</span>
                    {i.dr ? <span>· DR {i.dr}</span> : null}
                    {typeof i.cost === 'number' && i.cost > 0 ? <span>· ${i.cost}</span> : null}
                  </div>
                </button>
              ))}
              {cards.length === 0 ? (
                <div className="text-[11px] text-muted-foreground text-center py-3 font-medium">— empty —</div>
              ) : null}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function FilteredEmpty() {
  return (
    <div className="rounded-lg border border-dashed border-border bg-card py-12 text-center text-sm text-muted-foreground">
      No items match the current filter.
    </div>
  )
}
