'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────
export type BudgetData = Record<string, Record<string, { min: number; max: number; actual: number; purpose: string }>>
export type GoalsData = Record<string, Record<string, { baseline: number; target: number; actual: number; unit?: string; label?: string }>>
type Directives = Record<string, { title: string; color: string; body: string }>

export interface CurrentState {
  asOf?: string
  channels?: Record<string, {
    label: string
    color?: string
    metrics?: { label: string; value: string }[]
    diagnosis?: string
  }>
  gap?: string
}

export interface AuthorityLayer {
  coreShift?: string
  positioning?: string
  q3Events?: { id: string; name: string; month: string; role: string; goals: string[] }[]
  california?: { name: string; kind: string; positioning: string; goals: string[] }
  reportSystem?: {
    intro?: string
    parts?: { n: number; title: string; desc: string }[]
  }
  measurement?: string[]
}

// Active month type ─ includes Q3/Q4 buckets so the Q3-Q4 plan from the
// strategy doc lives in the same editor.
type MonthKey = 'april' | 'may' | 'june' | 'q3' | 'q4'

const CHANNEL_COLORS: Record<string, string> = {
  linkBuilding: 'bg-emerald-500',
  linkedin: 'bg-blue-600',
  instagram: 'bg-pink-500',
  pr: 'bg-violet-600',
  telegram: 'bg-sky-500',
  events: 'bg-amber-500',
  california: 'bg-orange-500',
  free: 'bg-slate-400',
}
const CHANNEL_LABELS: Record<string, string> = {
  linkBuilding: 'Link Building',
  linkedin: 'LinkedIn',
  instagram: 'Instagram',
  pr: 'PR',
  telegram: 'Telegram',
  events: 'Online Events',
  california: 'California',
  free: 'Free Sources',
}
const MONTHS: MonthKey[] = ['april', 'may', 'june', 'q3', 'q4']
const MONTH_LABEL: Record<MonthKey, string> = {
  april: 'April',
  may: 'May',
  june: 'June',
  q3: 'Q3',
  q4: 'Q4',
}

// ────────────────────────────────────────────────────────────────────────────
// Main editor
// ────────────────────────────────────────────────────────────────────────────
export function StrategyEditor({
  initial,
}: {
  initial: {
    activeBudgetMonth: MonthKey
    budget: BudgetData
    goals: GoalsData
    channelDirectives: Directives
    currentState: CurrentState | null
    authorityLayer: AuthorityLayer | null
  }
}) {
  const router = useRouter()
  const [activeMonth, setActiveMonth] = useState<MonthKey>(initial.activeBudgetMonth)
  const [budget, setBudget] = useState<BudgetData>(initial.budget)
  const [goals, setGoals] = useState<GoalsData>(initial.goals)
  const [saving, setSaving] = useState(false)

  async function save(updates: Partial<{ activeBudgetMonth: MonthKey; budget: BudgetData; goals: GoalsData }>) {
    setSaving(true)
    try {
      const res = await fetch('/api/marketing/strategy', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data?.error ?? 'Save failed')
        return
      }
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  function changeMonth(m: MonthKey) {
    setActiveMonth(m)
    save({ activeBudgetMonth: m })
  }

  function updateBudgetActual(month: string, ch: string, val: number) {
    const next: BudgetData = JSON.parse(JSON.stringify(budget))
    if (next[month]?.[ch]) {
      next[month][ch].actual = val
      setBudget(next)
      save({ budget: next })
    }
  }

  function updateGoalActual(cat: string, metric: string, val: number) {
    const next: GoalsData = JSON.parse(JSON.stringify(goals))
    if (next[cat]?.[metric]) {
      next[cat][metric].actual = val
      setGoals(next)
      save({ goals: next })
    }
  }

  const monthBudget = budget[activeMonth] ?? {}
  let totalActual = 0
  let totalMax = 0
  for (const ch of Object.values(monthBudget)) {
    totalActual += ch.actual
    totalMax += ch.max
  }
  const overallPct = totalMax > 0 ? Math.round((totalActual / totalMax) * 100) : 0

  return (
    <div className="space-y-6">
      {/* Current State / Baseline card — top of the editor */}
      {initial.currentState ? <CurrentStateCard data={initial.currentState} /> : null}

      {/* Budget editor */}
      <section className="bg-card border border-border rounded-lg shadow-sm">
        <header className="px-5 py-3.5 border-b border-border flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="font-semibold">Budget — {MONTH_LABEL[activeMonth]}{activeMonth === 'q3' || activeMonth === 'q4' ? ' 2026 (quarter)' : ' 2026'}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Edit the actual spend column inline · auto-saves on blur.</p>
          </div>
          <div className="inline-flex p-0.5 bg-muted rounded-md border border-border flex-wrap">
            {MONTHS.map((m) => (
              <button
                key={m}
                onClick={() => changeMonth(m)}
                className={cn(
                  'px-2.5 py-1 text-xs font-semibold rounded-sm transition-colors',
                  activeMonth === m ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {MONTH_LABEL[m]}
              </button>
            ))}
          </div>
        </header>

        <div className="px-5 py-3 grid grid-cols-3 gap-3 border-b border-border bg-muted/20">
          <KpiCell label="Spent" value={`$${totalActual.toLocaleString()}`} />
          <KpiCell label="Planned ceiling" value={`$${totalMax.toLocaleString()}`} />
          <KpiCell
            label="Of ceiling"
            value={`${overallPct}%`}
            accent={overallPct > 100 ? 'text-red-600' : overallPct >= 70 ? 'text-emerald-600' : 'text-blue-600'}
          />
        </div>

        <div className="p-5 space-y-4">
          {Object.entries(monthBudget).map(([ch, data]) => {
            const fillPct = data.max > 0 ? Math.min(100, (data.actual / data.max) * 100) : 0
            const isOver = data.actual > data.max && data.max > 0
            const range = data.min === data.max ? `$${data.max.toLocaleString()}` : `$${data.min.toLocaleString()}–${data.max.toLocaleString()}`
            return (
              <div key={ch}>
                <div className="flex items-center justify-between gap-3 mb-1.5">
                  <span className="font-medium text-sm flex items-center gap-2">
                    <span className={cn('inline-block w-2 h-2 rounded-full', CHANNEL_COLORS[ch] ?? 'bg-muted')} />
                    {CHANNEL_LABELS[ch] ?? ch}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-muted-foreground tabular-nums">of {range}</span>
                    <span className="text-[11px] text-muted-foreground">$</span>
                    <Input
                      type="number"
                      defaultValue={data.actual}
                      onBlur={(e) => {
                        const v = parseFloat(e.target.value) || 0
                        if (v !== data.actual) updateBudgetActual(activeMonth, ch, v)
                      }}
                      className="h-7 w-24 text-right text-xs"
                      step="10"
                      min="0"
                    />
                  </div>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all', isOver ? 'bg-red-500' : CHANNEL_COLORS[ch] ?? 'bg-primary')}
                    style={{ width: `${fillPct}%` }}
                  />
                </div>
                {data.purpose ? <p className="text-[11px] text-muted-foreground mt-1.5">{data.purpose}</p> : null}
              </div>
            )
          })}
        </div>
      </section>

      {/* Goals editor */}
      <section className="bg-card border border-border rounded-lg shadow-sm">
        <header className="px-5 py-3.5 border-b border-border">
          <h3 className="font-semibold">Channel Goals</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Update the actual column as new data comes in. Auto-saves on blur.</p>
        </header>
        <div className="divide-y divide-border">
          {Object.entries(goals).map(([cat, metrics]) => (
            <div key={cat} className="p-5">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-2">{cat}</div>
              <div className="space-y-2.5">
                {Object.entries(metrics).map(([k, g]) => {
                  const range = g.target - g.baseline
                  const progress = range === 0 ? 100 : ((g.actual - g.baseline) / range) * 100
                  const pct = Math.max(0, Math.min(100, progress))
                  let badge: string, statusCls: string
                  if (g.actual >= g.target) { badge = '✓ Hit'; statusCls = 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' }
                  else if (progress >= 70) { badge = 'Close'; statusCls = 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300' }
                  else if (progress >= 20) { badge = 'Moving'; statusCls = 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300' }
                  else if (g.actual < g.baseline) { badge = 'Below'; statusCls = 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300' }
                  else { badge = 'Baseline'; statusCls = 'bg-muted text-muted-foreground' }
                  return (
                    <div key={k} className="grid items-center gap-3" style={{ gridTemplateColumns: '1fr 100px 110px 1fr 70px' }}>
                      <div className="text-sm font-medium">{g.label ?? k}</div>
                      <div className="text-center text-xs">
                        <div className="font-semibold tabular-nums">{g.baseline}{g.unit ?? ''}</div>
                        <div className="text-[9px] uppercase tracking-widest text-muted-foreground">baseline</div>
                      </div>
                      <div>
                        <Input
                          type="number"
                          step="any"
                          defaultValue={g.actual}
                          onBlur={(e) => {
                            const v = parseFloat(e.target.value) || 0
                            if (v !== g.actual) updateGoalActual(cat, k, v)
                          }}
                          className="h-7 text-center text-xs"
                        />
                        <div className="text-[9px] uppercase tracking-widest text-muted-foreground text-center mt-0.5">actual{g.unit ? ` (${g.unit})` : ''}</div>
                      </div>
                      <div className="relative h-2 bg-muted rounded-full overflow-hidden">
                        <div className="absolute inset-y-0 left-0 bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="text-center">
                        <span className={cn('inline-block px-2 py-0.5 rounded text-[10px] font-bold', statusCls)}>{badge}</span>
                        <div className="text-[10px] text-muted-foreground tabular-nums mt-1">→ {g.target}{g.unit ?? ''}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      {Object.keys(initial.channelDirectives ?? {}).length ? (
        <section className="bg-card border border-border rounded-lg shadow-sm">
          <header className="px-5 py-3.5 border-b border-border">
            <h3 className="font-semibold">Channel Directives</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Q2 strategy reference per channel.</p>
          </header>
          <div className="p-5 grid gap-2.5 sm:grid-cols-2">
            {Object.values(initial.channelDirectives).map((d) => (
              <div key={d.title} className="bg-muted/30 border-l-4 rounded p-3 text-sm leading-relaxed" style={{ borderLeftColor: d.color }}>
                <div className="text-[10px] uppercase tracking-widest font-semibold mb-1" style={{ color: d.color }}>{d.title}</div>
                {d.body}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* Q3-Q4 Authority Layer — read-only narrative section */}
      {initial.authorityLayer ? <AuthorityLayerCard data={initial.authorityLayer} /> : null}

      {saving ? (
        <div className="fixed bottom-4 right-4 bg-card border border-border rounded-md px-3 py-1.5 text-xs shadow-md">
          Saving…
        </div>
      ) : null}
    </div>
  )
}

function KpiCell({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="text-center">
      <div className={cn('text-lg font-bold tabular-nums', accent)}>{value}</div>
      <div className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground mt-0.5">{label}</div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Current State / Baseline diagnosis card (top of the page)
// ────────────────────────────────────────────────────────────────────────────
function CurrentStateCard({ data }: { data: CurrentState }) {
  const channels = data.channels ? Object.entries(data.channels) : []
  return (
    <section className="bg-card border border-border rounded-lg shadow-sm">
      <header className="px-5 py-3.5 border-b border-border">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h3 className="font-semibold">Current State — Where We Are Now</h3>
          {data.asOf ? <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">as of {data.asOf}</span> : null}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">Baseline diagnosis from the Q2 strategy doc. Reference only — measured against current goals above.</p>
      </header>
      <div className="p-5 grid gap-3 sm:grid-cols-2">
        {channels.map(([key, c]) => (
          <div key={key} className="border border-border rounded-md p-3 bg-muted/20">
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-block w-2 h-2 rounded-full" style={{ background: c.color ?? 'hsl(var(--muted-foreground))' }} />
              <h4 className="text-sm font-semibold">{c.label}</h4>
            </div>
            {c.metrics && c.metrics.length > 0 ? (
              <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs mb-2">
                {c.metrics.map((m, i) => (
                  <div key={i} className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">{m.label}</dt>
                    <dd className="font-semibold tabular-nums">{m.value}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
            {c.diagnosis ? <p className="text-xs leading-relaxed text-foreground/80 italic">{c.diagnosis}</p> : null}
          </div>
        ))}
      </div>
      {data.gap ? (
        <div className="px-5 pb-5">
          <div className="bg-amber-50 dark:bg-amber-950/30 border-l-4 border-amber-500 rounded p-3 text-sm leading-relaxed">
            <div className="text-[10px] uppercase tracking-widest font-bold text-amber-700 dark:text-amber-300 mb-1">The Gap</div>
            {data.gap}
          </div>
        </div>
      ) : null}
    </section>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Q3-Q4 Authority Layer card — events / California / report system
// ────────────────────────────────────────────────────────────────────────────
function AuthorityLayerCard({ data }: { data: AuthorityLayer }) {
  return (
    <section className="bg-card border border-border rounded-lg shadow-sm">
      <header className="px-5 py-3.5 border-b border-border">
        <h3 className="font-semibold">Q3 — Q4 Authority Layer</h3>
        <p className="text-xs text-muted-foreground mt-0.5">Strategic direction: events, reports, California — content/PR/events become one system.</p>
      </header>

      <div className="p-5 space-y-5">
        {data.coreShift ? (
          <div className="bg-primary/5 border-l-4 border-primary rounded p-3 text-sm font-medium leading-relaxed">{data.coreShift}</div>
        ) : null}
        {data.positioning ? (
          <div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1">Positioning</div>
            <p className="text-sm leading-relaxed">{data.positioning}</p>
          </div>
        ) : null}

        {data.q3Events && data.q3Events.length > 0 ? (
          <div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-2">Q3 Online Events — three in sequence</div>
            <div className="grid gap-2.5 sm:grid-cols-3">
              {data.q3Events.map((ev) => (
                <div key={ev.id} className="border border-border rounded-md p-3 bg-muted/20">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <h4 className="text-sm font-bold">{ev.name}</h4>
                    <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">{ev.month}</span>
                  </div>
                  <p className="text-xs text-foreground/80 mb-2 leading-relaxed">{ev.role}</p>
                  <ul className="text-[11px] text-muted-foreground space-y-1 list-disc pl-3.5">
                    {ev.goals.map((g, i) => <li key={i}>{g}</li>)}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {data.california ? (
          <div className="border border-orange-300 dark:border-orange-700 rounded-md p-3 bg-gradient-to-r from-orange-50 to-card dark:from-orange-950/30">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-orange-500" />
              <h4 className="text-sm font-bold">{data.california.name}</h4>
              <span className="text-[10px] uppercase tracking-widest font-semibold text-orange-700 dark:text-orange-300 ml-auto">{data.california.kind}</span>
            </div>
            <p className="text-xs text-foreground/80 mb-2 leading-relaxed">{data.california.positioning}</p>
            <ul className="text-[11px] text-muted-foreground space-y-1 list-disc pl-3.5">
              {data.california.goals.map((g, i) => <li key={i}>{g}</li>)}
            </ul>
          </div>
        ) : null}

        {data.reportSystem ? (
          <div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-2">Report System — one core report, four parts</div>
            {data.reportSystem.intro ? <p className="text-xs text-muted-foreground mb-2 italic">{data.reportSystem.intro}</p> : null}
            <div className="grid gap-2 sm:grid-cols-2">
              {(data.reportSystem.parts ?? []).map((p) => (
                <div key={p.n} className="border border-border rounded-md p-2.5 bg-muted/20 flex gap-2.5">
                  <div className="shrink-0 w-7 h-7 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-xs">{p.n}</div>
                  <div>
                    <div className="text-sm font-semibold leading-tight">{p.title}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{p.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {data.measurement && data.measurement.length > 0 ? (
          <div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-2">What We're Measuring</div>
            <ul className="grid sm:grid-cols-2 gap-1.5 text-xs">
              {data.measurement.map((m, i) => (
                <li key={i} className="flex gap-2 items-start">
                  <span className="text-emerald-600 mt-0.5">✓</span>
                  <span className="leading-relaxed">{m}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  )
}
