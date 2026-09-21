'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import useSWR from 'swr'
import {
  LineChart,
  Line,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  Legend,
} from 'recharts'
import {
  BarChart3,
  Search,
  Link2,
  AlertCircle,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Info,
  AlertTriangle,
  ShieldAlert,
  Wrench,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

type Period = 7 | 28 | 90

const PERIODS: Period[] = [7, 28, 90]

const fetcher = (url: string) => fetch(url).then((r) => r.json())

interface Props {
  connection: {
    ga4Configured: boolean
    gscConfigured: boolean
    ahrefsConfigured: boolean
  }
}

export function AnalyticsClient({ connection }: Props) {
  const [period, setPeriod] = useState<Period>(28)

  const anythingConfigured =
    connection.ga4Configured || connection.gscConfigured || connection.ahrefsConfigured

  const { data: overview, isLoading, mutate } = useSWR(
    anythingConfigured ? `/api/analytics/overview?period=${period}` : null,
    fetcher,
    { revalidateOnFocus: false }
  )

  if (!anythingConfigured) {
    return (
      <div className="bg-card border border-border shadow-sm p-10 text-center">
        <BarChart3 className="h-10 w-10 mx-auto text-muted-foreground" />
        <h2 className="mt-4 font-display text-xl font-semibold">No integrations connected</h2>
        <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
          Connect Google Analytics 4, Search Console or Ahrefs to see metrics here.
        </p>
        <Button asChild className="mt-6">
          <Link href="/settings/integrations">Configure integrations</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex items-center gap-1 bg-secondary p-1">
          {PERIODS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={
                'px-3 py-1.5 text-sm font-medium transition-colors ' +
                (period === p ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground')
              }
            >
              Last {p} days
            </button>
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={() => mutate()}>
          Refresh
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-card border border-border p-5 h-24 animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          <HeroSection metrics={overview?.heroMetrics ?? []} />
          <DeepIndexationSection />
          <SeoIssuesSection issues={overview?.seoIssues ?? []} />
          <IndexationReportSection report={overview?.indexationReport ?? null} />
          <LandingPagePerformance rows={overview?.landingPageReport ?? []} />
          <Ga4Section data={overview?.ga4} configured={connection.ga4Configured} />
          <GscSection data={overview?.gsc} configured={connection.gscConfigured} />
          <AhrefsSection data={overview?.ahrefs} configured={connection.ahrefsConfigured} />
        </>
      )}
    </div>
  )
}

/* ============================================================ */
/* Hero — 6 KPIs at the top                                     */
/* ============================================================ */

function HeroSection({ metrics }: { metrics: any[] }) {
  if (metrics.length === 0) return null
  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {metrics.map((m) => (
        <HeroTile key={m.key} m={m} />
      ))}
    </section>
  )
}

function HeroTile({ m }: { m: any }) {
  const toneRing =
    m.status === 'ok'
      ? 'border-emerald-500/30 shadow-[0_0_0_1px_rgba(16,185,129,0.10)_inset]'
      : m.status === 'warn'
      ? 'border-amber-500/30 shadow-[0_0_0_1px_rgba(245,158,11,0.10)_inset]'
      : m.status === 'bad'
      ? 'border-red-500/40 shadow-[0_0_0_1px_rgba(239,68,68,0.12)_inset]'
      : m.status === 'pending'
      ? 'border-dashed border-muted-foreground/40'
      : 'border-border'
  const toneDot =
    m.status === 'ok'
      ? 'bg-emerald-500'
      : m.status === 'warn'
      ? 'bg-amber-500'
      : m.status === 'bad'
      ? 'bg-red-500'
      : m.status === 'pending'
      ? 'bg-muted-foreground/40'
      : 'bg-muted-foreground/20'
  const display =
    m.value == null || !Number.isFinite(m.value)
      ? '—'
      : m.format === 'percent'
      ? `${(m.value * 100).toFixed(1)}%`
      : m.format === 'decimal'
      ? Number(m.value).toFixed(1)
      : m.format === 'ratio'
      ? Number(m.value).toFixed(2)
      : Math.round(m.value).toLocaleString()
  return (
    <div className={`bg-card border ${toneRing} p-5 flex flex-col gap-2 shadow-sm`}>
      <div className="flex items-center gap-2">
        <span className={`h-1.5 w-1.5 ${toneDot}`} />
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">{m.label}</p>
        <span className="ml-auto text-[9px] uppercase tracking-widest text-muted-foreground/70">
          {m.source}
        </span>
      </div>
      <p className="font-display text-3xl font-semibold tabular-nums leading-none">{display}</p>
      {m.hint ? <p className="text-[11px] text-muted-foreground mt-auto">{m.hint}</p> : null}
    </div>
  )
}

/* ============================================================ */
/* Deep indexation scan — sitemap-driven, whole site             */
/* ============================================================ */

function DeepIndexationSection() {
  const { data, error, isLoading, isValidating, mutate } = useSWR(
    '/api/analytics/deep-scan',
    fetcher,
    { revalidateOnFocus: false, revalidateOnReconnect: false, dedupingInterval: 60_000 }
  )
  const report = data?.data
  const scanning = isLoading || (isValidating && !report)

  return (
    <section className="bg-card border border-border shadow-sm">
      <div className="px-6 py-4 border-b border-border flex items-center gap-3 flex-wrap">
        <ShieldAlert className="h-4 w-4 text-muted-foreground" />
        <h2 className="font-display font-semibold text-lg tracking-tight">Full site indexation scan</h2>
        {scanning ? (
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="h-1.5 w-1.5 bg-amber-500 animate-pulse" />
            Scanning sitemap · this takes 30-90s on first run…
          </span>
        ) : report ? (
          <span className="text-xs text-muted-foreground">
            Scanned {report.totalInspected} URLs from sitemap · {new Date(report.scannedAt).toLocaleString()}
          </span>
        ) : null}
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => mutate()} loading={isValidating} disabled={scanning}>
            Refresh
          </Button>
        </div>
      </div>

      {scanning ? (
        <div className="p-8 space-y-4">
          <div className="text-sm text-muted-foreground text-center">
            Fetching sitemap.xml · Inspecting up to 300 URLs via GSC URL Inspection · Grouping by coverage state
          </div>
          <div className="max-w-md mx-auto grid gap-2">
            {['Fetching sitemap.xml', 'Enumerating URLs', 'Running URL Inspection (batches of 25)', 'Classifying and grouping']
              .map((label, i) => (
                <div key={label} className="flex items-center gap-3 text-xs">
                  <div className="h-1 flex-1 bg-secondary overflow-hidden">
                    <div className="h-full bg-amber-500 animate-pulse" style={{ width: `${(i + 1) * 25}%` }} />
                  </div>
                  <span className="text-muted-foreground min-w-max">{label}</span>
                </div>
              ))}
          </div>
          <p className="text-[11px] text-muted-foreground text-center">
            Cached 12h after the first run — subsequent page loads are instant.
          </p>
        </div>
      ) : error ? (
        <div className="p-6 text-sm text-amber-700 bg-amber-50/50 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{error.message ?? String(error)}</span>
        </div>
      ) : !report ? null : (
        <>
          <div className="px-6 py-4 border-b border-border bg-secondary/30 grid gap-2 sm:grid-cols-2 lg:grid-cols-4 text-sm">
            <IndexSummary label={`In sitemap`} count={report.totalInSitemap} tone="ok" />
            <IndexSummary label={`Inspected`} count={report.totalInspected} tone="ok" />
            <IndexSummary label={`Indexed`} count={report.indexedCount} tone="ok" />
            <IndexSummary label={`Problem pages`} count={report.problemCount} tone="bad" />
          </div>
          {report.quotaWarning ? (
            <div className="px-6 py-3 border-b border-border text-xs text-amber-700 bg-amber-50/50 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>Scan stopped early: {report.quotaWarning}</span>
            </div>
          ) : null}
          <ul className="divide-y divide-border">
            {report.groups.map((g: any) => (
              <CoverageGroupRow key={g.bucket} g={g} />
            ))}
          </ul>
        </>
      )}
    </section>
  )
}

function CoverageGroupRow({ g }: { g: any }) {
  const [open, setOpen] = useState(g.severity === 'critical')
  const tone =
    g.severity === 'critical'
      ? { badge: 'bg-red-500/10 text-red-700 border-red-500/20', bar: 'bg-red-500', icon: ShieldAlert }
      : g.severity === 'warning'
      ? { badge: 'bg-amber-500/10 text-amber-700 border-amber-500/20', bar: 'bg-amber-500', icon: AlertTriangle }
      : g.severity === 'info'
      ? { badge: 'bg-sky-500/10 text-sky-700 border-sky-500/20', bar: 'bg-sky-500', icon: Info }
      : { badge: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20', bar: 'bg-emerald-500', icon: CheckCircle2 }
  const BadgeIcon = tone.icon

  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen((x) => !x)}
        className="w-full flex items-stretch gap-3 text-left hover:bg-secondary/40 transition-colors"
      >
        <div className={`w-1 shrink-0 ${tone.bar}`} />
        <div className="min-w-0 flex-1 py-3 pr-6">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-widest ${tone.badge}`}
            >
              <BadgeIcon className="h-3 w-3" />
              {g.severity}
            </span>
            <span className="text-sm font-semibold">{g.titleUa}</span>
            <span className="text-[11px] text-muted-foreground">{g.titleEn}</span>
            <span className="ml-auto text-sm font-display font-semibold tabular-nums">{g.pages.length}</span>
          </div>
          {open ? (
            <div className="mt-3 space-y-3 pl-1">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1">Why</p>
                <p className="text-xs leading-relaxed">{g.explanation}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1">Fix</p>
                <p className="text-xs leading-relaxed">{g.fix}</p>
              </div>
              <details className="border border-border">
                <summary className="cursor-pointer list-none px-3 py-2 text-xs bg-secondary/40 hover:bg-secondary/60">
                  Show {g.pages.length} URL(s)
                </summary>
                <ul className="divide-y divide-border max-h-96 overflow-y-auto">
                  {g.pages.map((p: any) => (
                    <li key={p.url} className="px-3 py-2 text-xs">
                      <a
                        href={p.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sky-700 hover:underline break-all"
                      >
                        {p.url}
                      </a>
                      <div className="mt-0.5 text-muted-foreground text-[11px] flex gap-3 flex-wrap">
                        {p.coverageState ? <span>coverage: {p.coverageState}</span> : null}
                        {p.googleCanonical && p.googleCanonical !== p.url ? (
                          <span>google canonical: <span className="break-all">{p.googleCanonical}</span></span>
                        ) : null}
                        {p.lastCrawlTime ? (
                          <span>crawled: {new Date(p.lastCrawlTime).toISOString().slice(0, 10)}</span>
                        ) : null}
                        {!p.inSitemap ? <span className="text-amber-600">not in sitemap</span> : null}
                      </div>
                    </li>
                  ))}
                </ul>
              </details>
            </div>
          ) : null}
        </div>
      </button>
    </li>
  )
}

/* ============================================================ */
/* Full indexation report                                       */
/* ============================================================ */

function IndexationReportSection({ report }: { report: any }) {
  const [filter, setFilter] = useState<'all' | 'problems' | 'indexed'>('problems')
  const [showAll, setShowAll] = useState(false)

  if (!report || report.total === 0) return null

  const shown = report.pages.filter((p: any) => {
    if (filter === 'all') return true
    if (filter === 'indexed') return p.status === 'indexed'
    return p.status !== 'indexed'
  })
  const visible = showAll ? shown : shown.slice(0, 10)

  return (
    <section className="bg-card border border-border shadow-sm">
      <div className="px-6 py-4 border-b border-border flex items-center gap-3 flex-wrap">
        <ShieldAlert className="h-4 w-4 text-muted-foreground" />
        <h2 className="font-display font-semibold text-lg tracking-tight">Indexation report</h2>
        <span className="text-xs text-muted-foreground">
          Live URL Inspection · top {report.total} pages by impressions
        </span>
        <div className="ml-auto flex items-center gap-2">
          <FilterPill
            active={filter === 'all'}
            onClick={() => setFilter('all')}
            label="All"
            count={report.total}
          />
          <FilterPill
            active={filter === 'problems'}
            onClick={() => setFilter('problems')}
            label="Problems"
            count={report.notIndexed + report.blocked + report.errors + report.indexedWithIssues}
            tone="red"
          />
          <FilterPill
            active={filter === 'indexed'}
            onClick={() => setFilter('indexed')}
            label="OK"
            count={report.indexed}
          />
        </div>
      </div>
      <div className="px-6 py-3 border-b border-border bg-secondary/30 grid gap-2 sm:grid-cols-2 lg:grid-cols-5 text-xs">
        <IndexSummary label="Indexed" count={report.indexed} tone="ok" />
        <IndexSummary label="With issues" count={report.indexedWithIssues} tone="warn" />
        <IndexSummary label="Not indexed" count={report.notIndexed} tone="bad" />
        <IndexSummary label="Blocked" count={report.blocked} tone="bad" />
        <IndexSummary label="Errors" count={report.errors} tone="bad" />
      </div>
      <ul className="divide-y divide-border">
        {visible.map((p: any) => (
          <IndexationPageRow key={p.page} p={p} />
        ))}
      </ul>
      {shown.length > visible.length ? (
        <div className="p-3 border-t border-border text-center">
          <button
            type="button"
            onClick={() => setShowAll(true)}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Show {shown.length - visible.length} more
          </button>
        </div>
      ) : showAll && shown.length > 10 ? (
        <div className="p-3 border-t border-border text-center">
          <button
            type="button"
            onClick={() => setShowAll(false)}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Show top 10
          </button>
        </div>
      ) : null}
    </section>
  )
}

function IndexSummary({ label, count, tone }: { label: string; count: number; tone: 'ok' | 'warn' | 'bad' }) {
  const bar = tone === 'ok' ? 'bg-emerald-500' : tone === 'warn' ? 'bg-amber-500' : 'bg-red-500'
  return (
    <div className="flex items-center gap-2">
      <span className={`w-1 h-4 ${bar}`} />
      <span className="text-muted-foreground uppercase tracking-widest text-[10px] font-semibold">{label}</span>
      <span className="ml-auto tabular-nums font-semibold">{count}</span>
    </div>
  )
}

function IndexationPageRow({ p }: { p: any }) {
  const [open, setOpen] = useState(p.status !== 'indexed' && (p.status === 'not_indexed' || p.status === 'blocked' || p.status === 'error'))
  const tone =
    p.status === 'indexed'
      ? { badge: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20', bar: 'bg-emerald-500', icon: CheckCircle2 }
      : p.status === 'indexed_with_issues'
      ? { badge: 'bg-amber-500/10 text-amber-700 border-amber-500/20', bar: 'bg-amber-500', icon: AlertTriangle }
      : p.status === 'not_indexed'
      ? { badge: 'bg-red-500/10 text-red-700 border-red-500/20', bar: 'bg-red-500', icon: XCircle }
      : p.status === 'blocked'
      ? { badge: 'bg-red-500/10 text-red-700 border-red-500/20', bar: 'bg-red-500', icon: ShieldAlert }
      : p.status === 'error'
      ? { badge: 'bg-red-500/10 text-red-700 border-red-500/20', bar: 'bg-red-500', icon: XCircle }
      : { badge: 'bg-secondary text-muted-foreground border-border', bar: 'bg-muted-foreground/40', icon: Info }
  const BadgeIcon = tone.icon

  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen((x) => !x)}
        className="w-full flex items-stretch gap-3 text-left hover:bg-secondary/40 transition-colors"
      >
        <div className={`w-1 shrink-0 ${tone.bar}`} />
        <div className="min-w-0 flex-1 py-3 pr-6">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-widest ${tone.badge}`}
            >
              <BadgeIcon className="h-3 w-3" />
              {p.status.replace(/_/g, ' ')}
            </span>
            <span className="text-[11px] text-muted-foreground tabular-nums">
              {p.impressions.toLocaleString()} impr · {p.clicks} clicks
            </span>
          </div>
          <p className="mt-1 text-sm font-medium leading-snug break-all">{p.page}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{p.headline}</p>
          {open ? (
            <div className="mt-3 space-y-3">
              {p.reason ? (
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1">
                    Why
                  </p>
                  <p className="text-xs leading-relaxed">{p.reason}</p>
                </div>
              ) : null}
              {p.fix ? (
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1">
                    Fix
                  </p>
                  <p className="text-xs leading-relaxed">{p.fix}</p>
                </div>
              ) : null}
              <div>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1">
                  Raw inspection
                </p>
                <div className="grid gap-1.5 sm:grid-cols-2 text-[11px] bg-secondary/40 border border-border p-3">
                  {Object.entries(p.facts).map(([k, v]) => (
                    <div key={k} className="flex gap-2 min-w-0">
                      <span className="text-muted-foreground shrink-0 w-32">{k}</span>
                      <span className="tabular-nums break-all">{(v as string) || '—'}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </button>
    </li>
  )
}

/* ============================================================ */
/* SEO Issues to fix                                            */
/* ============================================================ */

function SeoIssuesSection({ issues }: { issues: any[] }) {
  const [filter, setFilter] = useState<'all' | 'critical' | 'warning' | 'info'>('all')
  const [expanded, setExpanded] = useState(false)

  const counts = useMemo(() => {
    return issues.reduce(
      (a, i) => {
        a[i.severity as 'critical' | 'warning' | 'info']++
        return a
      },
      { critical: 0, warning: 0, info: 0 }
    )
  }, [issues])

  if (issues.length === 0) {
    return (
      <section className="bg-card border border-border shadow-sm">
        <div className="px-6 py-4 border-b border-border flex items-center gap-2">
          <Wrench className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-display font-semibold text-lg tracking-tight">SEO issues to fix</h2>
        </div>
        <div className="p-8 text-center text-sm text-emerald-700 flex items-center justify-center gap-2">
          <CheckCircle2 className="h-4 w-4" />
          Nothing critical detected in the current data window.
        </div>
      </section>
    )
  }

  const filtered = filter === 'all' ? issues : issues.filter((i) => i.severity === filter)
  const visible = expanded ? filtered : filtered.slice(0, 15)

  return (
    <section className="bg-card border border-border shadow-sm">
      <div className="px-6 py-4 border-b border-border flex items-center gap-3 flex-wrap">
        <Wrench className="h-4 w-4 text-muted-foreground" />
        <h2 className="font-display font-semibold text-lg tracking-tight">SEO issues to fix</h2>
        <div className="ml-auto flex items-center gap-2">
          <FilterPill
            active={filter === 'all'}
            onClick={() => setFilter('all')}
            label="All"
            count={issues.length}
          />
          <FilterPill
            active={filter === 'critical'}
            onClick={() => setFilter('critical')}
            label="Critical"
            count={counts.critical}
            tone="red"
          />
          <FilterPill
            active={filter === 'warning'}
            onClick={() => setFilter('warning')}
            label="Warning"
            count={counts.warning}
            tone="amber"
          />
          <FilterPill
            active={filter === 'info'}
            onClick={() => setFilter('info')}
            label="Opportunity"
            count={counts.info}
            tone="blue"
          />
        </div>
      </div>
      <ul className="divide-y divide-border">
        {visible.map((i) => (
          <IssueRow key={i.id} i={i} />
        ))}
      </ul>
      {filtered.length > visible.length ? (
        <div className="p-3 border-t border-border text-center">
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Show {filtered.length - visible.length} more
          </button>
        </div>
      ) : expanded && filtered.length > 15 ? (
        <div className="p-3 border-t border-border text-center">
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Show top 15
          </button>
        </div>
      ) : null}
    </section>
  )
}

function FilterPill({
  label,
  count,
  active,
  onClick,
  tone,
}: {
  label: string
  count: number
  active: boolean
  onClick: () => void
  tone?: 'red' | 'amber' | 'blue'
}) {
  const toneCls =
    tone === 'red'
      ? 'text-red-700 border-red-200 bg-red-500/10'
      : tone === 'amber'
      ? 'text-amber-700 border-amber-200 bg-amber-500/10'
      : tone === 'blue'
      ? 'text-sky-700 border-sky-200 bg-sky-500/10'
      : 'text-muted-foreground border-border bg-secondary'
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        'inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold uppercase tracking-widest border transition-colors ' +
        (active ? toneCls : 'text-muted-foreground border-border hover:bg-secondary/60')
      }
    >
      {label}
      <span className="tabular-nums">{count}</span>
    </button>
  )
}

function IssueRow({ i }: { i: any }) {
  const [open, setOpen] = useState(false)
  const tone =
    i.severity === 'critical'
      ? { badge: 'bg-red-500/10 text-red-700 border-red-500/20', icon: ShieldAlert, bar: 'bg-red-500' }
      : i.severity === 'warning'
      ? { badge: 'bg-amber-500/10 text-amber-700 border-amber-500/20', icon: AlertTriangle, bar: 'bg-amber-500' }
      : { badge: 'bg-sky-500/10 text-sky-700 border-sky-500/20', icon: Info, bar: 'bg-sky-500' }
  const BadgeIcon = tone.icon
  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen((x) => !x)}
        className="w-full flex items-start gap-3 px-6 py-3 text-left hover:bg-secondary/40 transition-colors"
      >
        <div className={`w-1 self-stretch shrink-0 ${tone.bar}`} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-widest ${tone.badge}`}
            >
              <BadgeIcon className="h-3 w-3" />
              {i.severity}
            </span>
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
              {i.category}
            </span>
            {i.impact ? (
              <span className="text-[11px] text-muted-foreground tabular-nums">{i.impact}</span>
            ) : null}
          </div>
          <p className="mt-1 text-sm font-medium leading-snug">{i.title}</p>
          {i.target ? (
            <p className="mt-0.5 text-xs text-muted-foreground truncate" title={i.target}>
              {i.target}
            </p>
          ) : null}
          {open ? <p className="mt-2 text-xs text-muted-foreground leading-relaxed">{i.fix}</p> : null}
        </div>
      </button>
    </li>
  )
}

/* ============================================================ */
/* Landing page performance — GA4 × GSC merged                  */
/* ============================================================ */

function LandingPagePerformance({ rows }: { rows: any[] }) {
  const [sortKey, setSortKey] = useState<
    'impressions' | 'clicks' | 'ctr' | 'position' | 'activeUsers' | 'engagedSessions' | 'engagementRate' | 'averageEngagementPerUser' | 'eventCount'
  >('impressions')
  const [dir, setDir] = useState<'asc' | 'desc'>('desc')
  const [showAll, setShowAll] = useState(false)

  const sorted = useMemo(() => {
    const arr = [...rows]
    arr.sort((a, b) => (dir === 'desc' ? b[sortKey] - a[sortKey] : a[sortKey] - b[sortKey]))
    return arr
  }, [rows, sortKey, dir])

  if (rows.length === 0) {
    return null
  }

  const visible = showAll ? sorted : sorted.slice(0, 20)

  const setSort = (k: typeof sortKey) => {
    if (k === sortKey) setDir(dir === 'desc' ? 'asc' : 'desc')
    else {
      setSortKey(k)
      setDir('desc')
    }
  }

  const headerCell = (k: typeof sortKey, label: string) => (
    <th
      className="px-3 py-2 text-right font-semibold cursor-pointer select-none whitespace-nowrap hover:text-foreground"
      onClick={() => setSort(k)}
    >
      {label}
      {sortKey === k ? <span className="ml-1">{dir === 'desc' ? '↓' : '↑'}</span> : null}
    </th>
  )

  return (
    <section className="bg-card border border-border shadow-sm">
      <div className="px-6 py-4 border-b border-border flex items-center gap-2 flex-wrap">
        <BarChart3 className="h-4 w-4 text-muted-foreground" />
        <h2 className="font-display font-semibold text-lg tracking-tight">Landing page performance</h2>
        <span className="text-xs text-muted-foreground ml-2">
          GA4 landing metrics × GSC organic search — click a column to sort
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-secondary/60 text-[11px] uppercase tracking-widest text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">Landing page</th>
              {headerCell('clicks', 'Clicks')}
              {headerCell('impressions', 'Impr')}
              {headerCell('ctr', 'CTR')}
              {headerCell('position', 'Avg pos')}
              {headerCell('activeUsers', 'Active users')}
              {headerCell('engagedSessions', 'Engaged sess')}
              {headerCell('engagementRate', 'Eng rate')}
              {headerCell('averageEngagementPerUser', 'Avg time/user')}
              {headerCell('eventCount', 'Events')}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {visible.map((r) => (
              <tr key={r.path}>
                <td className="px-3 py-2 max-w-[320px] truncate" title={r.fullUrl ?? r.path}>
                  {r.path}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{r.clicks.toLocaleString()}</td>
                <td className="px-3 py-2 text-right tabular-nums">{r.impressions.toLocaleString()}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {r.impressions > 0 ? `${(r.ctr * 100).toFixed(2)}%` : '—'}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {r.impressions > 0 ? r.position.toFixed(1) : '—'}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{r.activeUsers.toLocaleString()}</td>
                <td className="px-3 py-2 text-right tabular-nums">{r.engagedSessions.toLocaleString()}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {r.activeUsers > 0 ? `${(r.engagementRate * 100).toFixed(0)}%` : '—'}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {r.activeUsers > 0 ? formatDurationS(r.averageEngagementPerUser) : '—'}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{r.eventCount.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {sorted.length > 20 ? (
        <div className="p-3 border-t border-border text-center">
          <button
            type="button"
            onClick={() => setShowAll((x) => !x)}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            {showAll ? 'Show top 20' : `Show all ${sorted.length}`}
          </button>
        </div>
      ) : null}
    </section>
  )
}

function formatDurationS(v: number): string {
  if (!Number.isFinite(v) || v <= 0) return '—'
  const s = Math.round(v)
  const m = Math.floor(s / 60)
  const sec = s % 60
  return m > 0 ? `${m}m ${String(sec).padStart(2, '0')}s` : `${sec}s`
}

/* ============================================================ */
/* Section shell                                                */
/* ============================================================ */

function SectionShell({
  title,
  icon: Icon,
  children,
  error,
  configured,
  href,
}: {
  title: string
  icon: any
  children: React.ReactNode
  error?: string | null
  configured: boolean
  href?: string
}) {
  if (!configured) {
    return (
      <section className="bg-card border border-border shadow-sm">
        <div className="px-6 py-4 border-b border-border flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-display font-semibold text-lg tracking-tight">{title}</h2>
        </div>
        <div className="p-8 text-center text-sm text-muted-foreground">
          Not configured. <Link href="/settings/integrations" className="underline">Set it up →</Link>
        </div>
      </section>
    )
  }

  return (
    <section className="bg-card border border-border shadow-sm">
      <div className="px-6 py-4 border-b border-border flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <h2 className="font-display font-semibold text-lg tracking-tight">{title}</h2>
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="ml-auto text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
          >
            Open in provider <ExternalLink className="h-3 w-3" />
          </a>
        ) : null}
      </div>
      {error ? (
        <div className="p-4 bg-amber-50/50 border-b border-border text-xs text-amber-700 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span className="min-w-0 break-words">{error}</span>
        </div>
      ) : null}
      <div className="p-6 space-y-8">{children}</div>
    </section>
  )
}

function SubSection({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h3 className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">{title}</h3>
        {hint ? <span className="text-[11px] text-muted-foreground">{hint}</span> : null}
      </div>
      {children}
    </div>
  )
}

function KpiTile({
  label,
  value,
  hint,
  format = 'number',
}: {
  label: string
  value: number | null | undefined
  hint?: string
  format?: 'number' | 'percent' | 'decimal' | 'duration' | 'currency'
}) {
  const display = useMemo(() => {
    if (value == null || !Number.isFinite(value)) return '—'
    if (format === 'percent') return `${(value * 100).toFixed(1)}%`
    if (format === 'decimal') return value.toFixed(2)
    if (format === 'duration') {
      const s = Math.max(0, Math.round(value))
      const m = Math.floor(s / 60)
      const sec = s % 60
      return m > 0 ? `${m}m ${sec}s` : `${sec}s`
    }
    if (format === 'currency') return `$${Math.round(value).toLocaleString()}`
    return Math.round(value).toLocaleString()
  }, [value, format])
  return (
    <div className="bg-secondary/40 border border-border p-4">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">{label}</p>
      <p className="mt-2 font-display text-2xl font-semibold tabular-nums">{display}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

/* ============================================================ */
/* GA4                                                          */
/* ============================================================ */

function Ga4Section({ data, configured }: { data: any; configured: boolean }) {
  const error = data?.__error
  const s = error ? null : data

  return (
    <SectionShell
      title="Google Analytics 4"
      icon={BarChart3}
      configured={configured}
      error={error}
      href="https://analytics.google.com/"
    >
      {!s ? (
        <p className="text-sm text-muted-foreground">No data.</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
            <KpiTile label="Sessions" value={s.totals?.sessions} />
            <KpiTile label="Users" value={s.totals?.totalUsers} />
            <KpiTile label="New users" value={s.totals?.newUsers} />
            <KpiTile label="Active users" value={s.totals?.activeUsers} />
            <KpiTile label="Page views" value={s.totals?.screenPageViews} />
            <KpiTile label="Events" value={s.totals?.eventCount} />
            <KpiTile label="Engagement rate" value={s.totals?.engagementRate} format="percent" />
            <KpiTile label="Bounce rate" value={s.totals?.bounceRate} format="percent" hint="Lower is better" />
            <KpiTile label="Avg session" value={s.totals?.averageSessionDuration} format="duration" />
            <KpiTile label="Views/session" value={s.totals?.screenPageViewsPerSession} format="decimal" />
            <KpiTile label="Sessions/user" value={s.totals?.sessionsPerUser} format="decimal" />
            <KpiTile label="Conversions" value={s.totals?.conversions} />
          </div>

          <SubSection title="Daily traffic">
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={s.daily ?? []}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="sessions" stroke="#0ea5e9" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="totalUsers" stroke="#8b5cf6" strokeWidth={2} dot={false} name="users" />
                  <Line
                    type="monotone"
                    dataKey="screenPageViews"
                    stroke="#22c55e"
                    strokeWidth={2}
                    dot={false}
                    name="page views"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </SubSection>

          <div className="grid gap-6 lg:grid-cols-2">
            <SubSection title="Top pages">
              <TopTable
                rows={s.topPages ?? []}
                columns={[
                  { key: 'key', label: 'Page', truncate: true },
                  { key: 'screenPageViews', label: 'Views', align: 'right' },
                  { key: 'sessions', label: 'Sess', align: 'right' },
                  { key: 'users', label: 'Users', align: 'right' },
                  { key: 'engagementRate', label: 'Eng', align: 'right', format: 'percent' },
                  { key: 'averageSessionDuration', label: 'Time', align: 'right', format: 'duration' },
                ]}
              />
            </SubSection>
            <SubSection title="Top landing pages">
              <TopTable
                rows={s.topLandingPages ?? []}
                columns={[
                  { key: 'key', label: 'Landing page', truncate: true },
                  { key: 'sessions', label: 'Sess', align: 'right' },
                  { key: 'users', label: 'Users', align: 'right' },
                  { key: 'engagementRate', label: 'Eng', align: 'right', format: 'percent' },
                  { key: 'bounceRate', label: 'Bnc', align: 'right', format: 'percent' },
                ]}
              />
            </SubSection>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <SubSection title="Channels">
              <TopTable
                rows={s.topChannels ?? []}
                columns={[
                  { key: 'key', label: 'Channel' },
                  { key: 'sessions', label: 'Sess', align: 'right' },
                  { key: 'users', label: 'Users', align: 'right' },
                  { key: 'engagementRate', label: 'Eng', align: 'right', format: 'percent' },
                  { key: 'conversions', label: 'Conv', align: 'right' },
                ]}
              />
            </SubSection>
            <SubSection title="Sources / medium">
              <TopTable
                rows={s.topSources ?? []}
                columns={[
                  { key: 'key', label: 'Source', truncate: true },
                  { key: 'sessions', label: 'Sess', align: 'right' },
                  { key: 'users', label: 'Users', align: 'right' },
                  { key: 'engagementRate', label: 'Eng', align: 'right', format: 'percent' },
                  { key: 'conversions', label: 'Conv', align: 'right' },
                ]}
              />
            </SubSection>
          </div>

          <SubSection title="External referrers">
            <TopTable
              rows={s.topReferrers ?? []}
              columns={[
                { key: 'key', label: 'Referrer URL', truncate: true },
                { key: 'sessions', label: 'Sess', align: 'right' },
                { key: 'users', label: 'Users', align: 'right' },
              ]}
            />
          </SubSection>

          <div className="grid gap-6 lg:grid-cols-2">
            <SubSection title="Top countries">
              <TopTable
                rows={s.topCountries ?? []}
                columns={[
                  { key: 'key', label: 'Country' },
                  { key: 'sessions', label: 'Sess', align: 'right' },
                  { key: 'users', label: 'Users', align: 'right' },
                  { key: 'engagementRate', label: 'Eng', align: 'right', format: 'percent' },
                  { key: 'conversions', label: 'Conv', align: 'right' },
                ]}
              />
            </SubSection>
            <SubSection title="Top cities">
              <TopTable
                rows={s.topCities ?? []}
                columns={[
                  { key: 'key', label: 'City, Country', truncate: true },
                  { key: 'sessions', label: 'Sess', align: 'right' },
                  { key: 'users', label: 'Users', align: 'right' },
                ]}
              />
            </SubSection>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <SubSection title="Devices">
              <TopTable
                rows={s.topDevices ?? []}
                columns={[
                  { key: 'key', label: 'Device' },
                  { key: 'sessions', label: 'Sess', align: 'right' },
                  { key: 'users', label: 'Users', align: 'right' },
                  { key: 'engagementRate', label: 'Eng', align: 'right', format: 'percent' },
                ]}
              />
            </SubSection>
            <SubSection title="Browsers">
              <TopTable
                rows={s.topBrowsers ?? []}
                columns={[
                  { key: 'key', label: 'Browser' },
                  { key: 'sessions', label: 'Sess', align: 'right' },
                  { key: 'users', label: 'Users', align: 'right' },
                ]}
              />
            </SubSection>
            <SubSection title="Operating systems">
              <TopTable
                rows={s.topOs ?? []}
                columns={[
                  { key: 'key', label: 'OS' },
                  { key: 'sessions', label: 'Sess', align: 'right' },
                  { key: 'users', label: 'Users', align: 'right' },
                ]}
              />
            </SubSection>
          </div>

          <SubSection title="Pages × countries" hint="Best performing page/country pairs">
            <TopTable
              rows={s.topPagesByCountry ?? []}
              columns={[
                { key: 'page', label: 'Page', truncate: true },
                { key: 'country', label: 'Country' },
                { key: 'sessions', label: 'Sess', align: 'right' },
                { key: 'users', label: 'Users', align: 'right' },
                { key: 'screenPageViews', label: 'Views', align: 'right' },
              ]}
            />
          </SubSection>
        </>
      )}
    </SectionShell>
  )
}

/* ============================================================ */
/* GSC                                                          */
/* ============================================================ */

function GscSection({ data, configured }: { data: any; configured: boolean }) {
  const error = data?.__error
  const s = error ? null : data
  return (
    <SectionShell
      title="Search Console"
      icon={Search}
      configured={configured}
      error={error}
      href="https://search.google.com/search-console"
    >
      {!s ? (
        <p className="text-sm text-muted-foreground">No data.</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <KpiTile label="Clicks" value={s.totals?.clicks} />
            <KpiTile label="Impressions" value={s.totals?.impressions} />
            <KpiTile label="CTR" value={s.totals?.ctr} format="percent" />
            <KpiTile label="Avg position" value={s.totals?.position} format="decimal" hint="Lower is better" />
          </div>

          <SubSection title="Clicks & impressions daily">
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={s.daily ?? []}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Bar yAxisId="left" dataKey="clicks" fill="#0ea5e9" />
                  <Bar yAxisId="right" dataKey="impressions" fill="#94a3b8" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </SubSection>

          <div className="grid gap-6 lg:grid-cols-2">
            <SubSection title="Top queries" hint={`${(s.topQueries ?? []).length} tracked`}>
              <TopTable
                rows={s.topQueries ?? []}
                columns={[
                  { key: 'key', label: 'Query' },
                  { key: 'clicks', label: 'Clicks', align: 'right' },
                  { key: 'impressions', label: 'Impr', align: 'right' },
                  { key: 'ctr', label: 'CTR', align: 'right', format: 'percent' },
                  { key: 'position', label: 'Pos', align: 'right', format: 'decimal' },
                ]}
                pageSize={25}
              />
            </SubSection>
            <SubSection title="Top pages" hint={`${(s.topPages ?? []).length} tracked`}>
              <TopTable
                rows={s.topPages ?? []}
                columns={[
                  { key: 'key', label: 'Page', truncate: true },
                  { key: 'clicks', label: 'Clicks', align: 'right' },
                  { key: 'impressions', label: 'Impr', align: 'right' },
                  { key: 'ctr', label: 'CTR', align: 'right', format: 'percent' },
                  { key: 'position', label: 'Pos', align: 'right', format: 'decimal' },
                ]}
                pageSize={25}
              />
            </SubSection>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <SubSection title="Countries">
              <TopTable
                rows={s.topCountries ?? []}
                columns={[
                  { key: 'key', label: 'Country' },
                  { key: 'clicks', label: 'Clicks', align: 'right' },
                  { key: 'impressions', label: 'Impr', align: 'right' },
                  { key: 'position', label: 'Pos', align: 'right', format: 'decimal' },
                ]}
              />
            </SubSection>
            <SubSection title="Devices">
              <TopTable
                rows={s.topDevices ?? []}
                columns={[
                  { key: 'key', label: 'Device' },
                  { key: 'clicks', label: 'Clicks', align: 'right' },
                  { key: 'impressions', label: 'Impr', align: 'right' },
                  { key: 'ctr', label: 'CTR', align: 'right', format: 'percent' },
                ]}
              />
            </SubSection>
            <SubSection title="Search appearance">
              <TopTable
                rows={s.topSearchAppearance ?? []}
                columns={[
                  { key: 'key', label: 'Appearance', truncate: true },
                  { key: 'clicks', label: 'Clicks', align: 'right' },
                  { key: 'impressions', label: 'Impr', align: 'right' },
                ]}
              />
            </SubSection>
          </div>

          <SubSection title="Queries by page" hint="Which query brings each page traffic">
            <TopTable
              rows={s.queriesByPage ?? []}
              columns={[
                { key: 'key', label: 'Page', truncate: true },
                { key: 'secondary', label: 'Query' },
                { key: 'clicks', label: 'Clicks', align: 'right' },
                { key: 'impressions', label: 'Impr', align: 'right' },
                { key: 'position', label: 'Pos', align: 'right', format: 'decimal' },
              ]}
              pageSize={25}
            />
          </SubSection>

          <SubSection title="Countries by page">
            <TopTable
              rows={s.countriesByPage ?? []}
              columns={[
                { key: 'key', label: 'Page', truncate: true },
                { key: 'secondary', label: 'Country' },
                { key: 'clicks', label: 'Clicks', align: 'right' },
                { key: 'impressions', label: 'Impr', align: 'right' },
                { key: 'position', label: 'Pos', align: 'right', format: 'decimal' },
              ]}
              pageSize={25}
            />
          </SubSection>

          <SubSection title="Sitemaps" hint="Submitted / indexed and errors">
            {(s.sitemaps ?? []).length === 0 ? (
              <p className="text-xs text-muted-foreground">No sitemaps registered in GSC.</p>
            ) : (
              <div className="border border-border overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-secondary/60 text-[11px] uppercase tracking-widest text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold">Path</th>
                      <th className="px-3 py-2 text-left font-semibold">Contents</th>
                      <th className="px-3 py-2 text-right font-semibold">Submitted</th>
                      <th className="px-3 py-2 text-right font-semibold">Indexed</th>
                      <th className="px-3 py-2 text-right font-semibold">Errors</th>
                      <th className="px-3 py-2 text-right font-semibold">Warnings</th>
                      <th className="px-3 py-2 text-left font-semibold">Downloaded</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {(s.sitemaps ?? []).map((sm: any) => {
                      const submitted = (sm.contents ?? []).reduce((a: number, c: any) => a + (c.submitted ?? 0), 0)
                      const indexed = (sm.contents ?? []).reduce((a: number, c: any) => a + (c.indexed ?? 0), 0)
                      return (
                        <tr key={sm.path}>
                          <td className="px-3 py-2 max-w-[280px] truncate" title={sm.path}>
                            {sm.path}
                          </td>
                          <td className="px-3 py-2 text-xs text-muted-foreground">
                            {(sm.contents ?? []).map((c: any) => c.type ?? 'web').join(', ') || '—'}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">{submitted.toLocaleString()}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{indexed.toLocaleString()}</td>
                          <td
                            className={
                              'px-3 py-2 text-right tabular-nums ' +
                              (sm.errors > 0 ? 'text-red-600 font-semibold' : '')
                            }
                          >
                            {sm.errors}
                          </td>
                          <td
                            className={
                              'px-3 py-2 text-right tabular-nums ' +
                              (sm.warnings > 0 ? 'text-amber-600' : '')
                            }
                          >
                            {sm.warnings}
                          </td>
                          <td className="px-3 py-2 text-xs text-muted-foreground">
                            {sm.lastDownloaded ? new Date(sm.lastDownloaded).toISOString().slice(0, 10) : '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </SubSection>

          <SubSection
            title="Indexation status (top pages)"
            hint="Live URL Inspection · verdicts explain why a page is or isn't in Google"
          >
            {s.inspectionsError ? (
              <div className="mb-3 p-3 bg-amber-50/50 border border-amber-200 text-xs text-amber-700 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <span className="min-w-0 break-words">URL Inspection: {s.inspectionsError}</span>
              </div>
            ) : null}
            {(s.inspections ?? []).length === 0 ? (
              <p className="text-xs text-muted-foreground">Nothing to inspect (no top pages yet).</p>
            ) : (
              <div className="space-y-2">
                {(s.inspections ?? []).map((i: any) => (
                  <InspectionRow key={i.page} i={i} />
                ))}
              </div>
            )}
          </SubSection>
        </>
      )}
    </SectionShell>
  )
}

function InspectionRow({ i }: { i: any }) {
  const ok = i.verdict === 'PASS'
  const partial = i.verdict === 'PARTIAL' || i.verdict === 'NEUTRAL'
  const fail = i.verdict === 'FAIL' || i.coverageState?.includes('not indexed')
  const badge = ok
    ? 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20'
    : partial
    ? 'bg-amber-500/10 text-amber-700 border-amber-500/20'
    : fail
    ? 'bg-red-500/10 text-red-700 border-red-500/20'
    : 'bg-secondary text-muted-foreground border-border'
  const BadgeIcon = ok ? CheckCircle2 : fail ? XCircle : Info

  return (
    <details className="border border-border">
      <summary className="cursor-pointer list-none flex items-center gap-3 px-3 py-2 hover:bg-secondary/40">
        <span className="min-w-0 flex-1 truncate text-sm" title={i.page}>
          {i.page}
        </span>
        <span className="text-[11px] text-muted-foreground tabular-nums whitespace-nowrap">
          {i.clicks} clicks · {i.impressions} impr
        </span>
        <span className={`inline-flex items-center gap-1 border px-2 py-0.5 text-[11px] font-semibold ${badge}`}>
          <BadgeIcon className="h-3 w-3" />
          {i.verdict ?? '—'}
        </span>
      </summary>
      <div className="p-4 grid gap-2 sm:grid-cols-2 text-xs bg-secondary/30">
        <Fact label="Coverage state" value={i.coverageState} />
        <Fact label="Indexing state" value={i.indexingState} />
        <Fact label="Robots.txt" value={i.robotsTxtState} />
        <Fact label="Page fetch" value={i.pageFetchState} />
        <Fact label="Crawled as" value={i.crawledAs} />
        <Fact
          label="Last crawl"
          value={i.lastCrawlTime ? new Date(i.lastCrawlTime).toISOString().replace('T', ' ').slice(0, 16) : null}
        />
        <Fact label="Google canonical" value={i.googleCanonical} />
        <Fact label="User canonical" value={i.userCanonical} />
        <Fact label="Mobile" value={i.mobileVerdict} />
        <Fact label="AMP" value={i.ampVerdict} />
        <Fact label="Rich results" value={i.richResultsVerdict} />
        <Fact label="In sitemap" value={(i.sitemap ?? []).join(', ') || null} />
        {i.error ? (
          <div className="sm:col-span-2 text-red-600">Error: {i.error}</div>
        ) : null}
      </div>
    </details>
  )
}

function Fact({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">{label}</span>
      <span className="tabular-nums break-words">{value || '—'}</span>
    </div>
  )
}

/* ============================================================ */
/* Ahrefs                                                       */
/* ============================================================ */

function AhrefsSection({ data, configured }: { data: any; configured: boolean }) {
  const error = data?.__error
  const s = error ? null : data
  const endpointErrors: Record<string, string> | null = s?.errors ?? null
  const hasEndpointErrors = endpointErrors && Object.keys(endpointErrors).length > 0

  return (
    <SectionShell
      title="Ahrefs"
      icon={Link2}
      configured={configured}
      error={error}
      href="https://app.ahrefs.com/"
    >
      {!s ? (
        <p className="text-sm text-muted-foreground">No data.</p>
      ) : (
        <>
          {hasEndpointErrors ? (
            <div className="p-3 bg-amber-50/50 border border-amber-200 text-xs text-amber-700 space-y-1">
              <div className="flex items-center gap-2 font-semibold">
                <AlertCircle className="h-3.5 w-3.5" /> Some Ahrefs endpoints failed
              </div>
              <ul className="pl-5 list-disc break-words">
                {Object.entries(endpointErrors!).map(([k, v]) => (
                  <li key={k}>
                    <code className="text-[11px]">{k}</code>: {v}
                  </li>
                ))}
              </ul>
              <p className="text-[11px]">
                Ahrefs API quota resets monthly — if all endpoints error with "units limit reached", wait for the
                reset date shown in Ahrefs → Account → API.
              </p>
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
            <KpiTile label="Domain Rating" value={s.overview?.domainRating} format="decimal" />
            <KpiTile label="Ahrefs Rank" value={s.overview?.ahrefsRank} hint="Lower is better" />
            <KpiTile label="Ref. domains" value={s.overview?.refDomains} hint={s.overview?.refDomainsDofollow != null ? `${s.overview.refDomainsDofollow} dofollow` : undefined} />
            <KpiTile label="Backlinks" value={s.overview?.backlinks} hint={s.overview?.backlinksDofollow != null ? `${s.overview.backlinksDofollow} dofollow` : undefined} />
            <KpiTile label="Ref. IPs" value={s.overview?.refIps} />
            <KpiTile label="Organic keywords" value={s.overview?.organicKeywords} />
            <KpiTile label="Organic traffic" value={s.overview?.organicTraffic} hint="Est. monthly visits" />
            <KpiTile label="Traffic value" value={s.overview?.organicTrafficValue} format="currency" />
            <KpiTile label="Organic pages" value={s.overview?.organicPages} />
            <KpiTile label="Paid keywords" value={s.overview?.paidKeywords} />
            <KpiTile label="Paid traffic" value={s.overview?.paidTraffic} />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <SubSection title="Top organic keywords">
              <TopTable
                rows={s.topKeywords ?? []}
                columns={[
                  { key: 'keyword', label: 'Keyword' },
                  { key: 'position', label: 'Pos', align: 'right' },
                  { key: 'volume', label: 'Vol', align: 'right' },
                  { key: 'trafficShare', label: 'Traf %', align: 'right', format: 'percent' },
                  { key: 'cpc', label: 'CPC', align: 'right', format: 'currency' },
                ]}
                pageSize={20}
              />
            </SubSection>
            <SubSection title="Top pages">
              <TopTable
                rows={s.topPages ?? []}
                columns={[
                  { key: 'url', label: 'URL', truncate: true },
                  { key: 'traffic', label: 'Traffic', align: 'right' },
                  { key: 'keywords', label: 'Kw', align: 'right' },
                  { key: 'topKeyword', label: 'Top keyword', truncate: true },
                  { key: 'topKeywordPosition', label: 'Pos', align: 'right' },
                ]}
                pageSize={20}
              />
            </SubSection>
          </div>

          <SubSection title="Top backlinks">
            <TopTable
              rows={s.topBacklinks ?? []}
              columns={[
                { key: 'urlFrom', label: 'From URL', truncate: true },
                { key: 'domainRatingSource', label: 'DR', align: 'right' },
                { key: 'urlRatingSource', label: 'UR', align: 'right' },
                { key: 'anchor', label: 'Anchor', truncate: true },
                { key: 'urlTo', label: 'To page', truncate: true },
                { key: 'isDofollow', label: 'Type', format: 'dofollow' },
                { key: 'firstSeen', label: 'First seen', format: 'date' },
              ]}
              pageSize={20}
            />
          </SubSection>

          <div className="grid gap-6 lg:grid-cols-2">
            <SubSection title="Top referring domains">
              <TopTable
                rows={s.topRefDomains ?? []}
                columns={[
                  { key: 'domain', label: 'Domain', truncate: true },
                  { key: 'domainRating', label: 'DR', align: 'right' },
                  { key: 'refPages', label: 'Pages', align: 'right' },
                  { key: 'linksToTarget', label: 'Links', align: 'right' },
                  { key: 'firstSeen', label: 'First seen', format: 'date' },
                ]}
                pageSize={20}
              />
            </SubSection>
            <SubSection title="Top anchor texts">
              <TopTable
                rows={s.topAnchors ?? []}
                columns={[
                  { key: 'anchor', label: 'Anchor', truncate: true },
                  { key: 'refDomains', label: 'Ref dom', align: 'right' },
                  { key: 'backlinks', label: 'Links', align: 'right' },
                  { key: 'refPages', label: 'Pages', align: 'right' },
                ]}
                pageSize={20}
              />
            </SubSection>
          </div>
        </>
      )}
    </SectionShell>
  )
}

/* ============================================================ */
/* Shared table                                                 */
/* ============================================================ */

interface Col {
  key: string
  label: string
  align?: 'left' | 'right'
  format?: 'percent' | 'decimal' | 'duration' | 'currency' | 'date' | 'dofollow'
  truncate?: boolean
}

function TopTable({ rows, columns, pageSize = 10 }: { rows: any[]; columns: Col[]; pageSize?: number }) {
  const [showAll, setShowAll] = useState(false)
  const visible = showAll ? rows : rows.slice(0, pageSize)
  return (
    <div>
      <div className="border border-border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-secondary/60 text-[11px] uppercase tracking-widest text-muted-foreground">
            <tr>
              {columns.map((c) => (
                <th key={c.key} className={`px-3 py-2 font-semibold ${c.align === 'right' ? 'text-right' : 'text-left'}`}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {visible.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-3 py-4 text-xs text-muted-foreground text-center">
                  No data
                </td>
              </tr>
            ) : (
              visible.map((r, i) => (
                <tr key={i}>
                  {columns.map((c) => {
                    const raw = r[c.key]
                    const value =
                      c.format === 'percent'
                        ? raw == null
                          ? '—'
                          : `${((raw ?? 0) * 100).toFixed(1)}%`
                        : c.format === 'decimal'
                        ? raw == null
                          ? '—'
                          : Number(raw).toFixed(1)
                        : c.format === 'duration'
                        ? formatDuration(raw)
                        : c.format === 'currency'
                        ? raw == null
                          ? '—'
                          : `$${Number(raw).toFixed(raw >= 1 ? 0 : 2)}`
                        : c.format === 'date'
                        ? raw
                          ? new Date(raw).toISOString().slice(0, 10)
                          : '—'
                        : c.format === 'dofollow'
                        ? raw === true
                          ? 'dofollow'
                          : raw === false
                          ? 'nofollow'
                          : '—'
                        : typeof raw === 'number'
                        ? Math.round(raw).toLocaleString()
                        : String(raw ?? '')
                    return (
                      <td
                        key={c.key}
                        className={`px-3 py-2 tabular-nums ${c.align === 'right' ? 'text-right' : ''} ${
                          c.truncate ? 'max-w-[280px] truncate' : ''
                        }`}
                        title={c.truncate ? String(raw ?? '') : undefined}
                      >
                        {value}
                      </td>
                    )
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {rows.length > pageSize ? (
        <button
          type="button"
          onClick={() => setShowAll((x) => !x)}
          className="mt-2 text-xs text-muted-foreground hover:text-foreground"
        >
          {showAll ? `Show top ${pageSize}` : `Show all ${rows.length}`}
        </button>
      ) : null}
    </div>
  )
}

function formatDuration(v: any): string {
  if (v == null || !Number.isFinite(Number(v))) return '—'
  const s = Math.max(0, Math.round(Number(v)))
  const m = Math.floor(s / 60)
  const sec = s % 60
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`
}
