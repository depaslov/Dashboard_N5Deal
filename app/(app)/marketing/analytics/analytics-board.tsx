'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { TrendingUp, TrendingDown, Minus, BarChart3, Maximize2 } from 'lucide-react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

export interface ReportSeries {
  id: string
  title: string
  periodLabel: string
  createdAt: string
  metrics: Record<string, Record<string, number | null>>
}

interface ChannelDef {
  k: string
  label: string
  color: string
  bg: string
  // Default chart metric + label
  primary: { k: string; label: string; prefix?: string; suffix?: string }
  // Other selectable metrics
  available: { k: string; label: string; prefix?: string; suffix?: string }[]
}

const CHANNELS: ChannelDef[] = [
  {
    k: 'instagram',
    label: 'Instagram',
    color: '#E1306C',
    bg: 'bg-pink-50 dark:bg-pink-950/20',
    primary: { k: 'followers', label: 'Followers' },
    available: [
      { k: 'followers', label: 'Followers' },
      { k: 'reach', label: 'Reach' },
      { k: 'impressions', label: 'Impressions' },
      { k: 'engagement', label: 'Engagement' },
      { k: 'profileVisits', label: 'Profile Visits' },
      { k: 'adSpend', label: 'Ad Spend', prefix: '$' },
      { k: 'ctr', label: 'CTR', suffix: '%' },
    ],
  },
  {
    k: 'youtube',
    label: 'YouTube',
    color: '#FF0000',
    bg: 'bg-red-50 dark:bg-red-950/20',
    primary: { k: 'views', label: 'Views' },
    available: [
      { k: 'subscribers', label: 'Subscribers' },
      { k: 'views', label: 'Views' },
      { k: 'watchTime', label: 'Watch Time', suffix: 'h' },
      { k: 'retention', label: 'Retention', suffix: '%' },
      { k: 'videoViews', label: 'Long-form Views' },
      { k: 'impressions', label: 'Impressions' },
    ],
  },
  {
    k: 'linkedin',
    label: 'LinkedIn',
    color: '#0A66C2',
    bg: 'bg-blue-50 dark:bg-blue-950/20',
    primary: { k: 'impressions', label: 'Impressions' },
    available: [
      { k: 'followers', label: 'Followers' },
      { k: 'impressions', label: 'Impressions' },
      { k: 'clicks', label: 'Clicks' },
      { k: 'reactions', label: 'Reactions' },
      { k: 'comments', label: 'Comments' },
      { k: 'engRate', label: 'Eng. Rate', suffix: '%' },
      { k: 'leads', label: 'Leads' },
      { k: 'spend', label: 'Ad Spend', prefix: '$' },
    ],
  },
  {
    k: 'website',
    label: 'Website',
    color: '#E37400',
    bg: 'bg-amber-50 dark:bg-amber-950/20',
    primary: { k: 'sessions', label: 'Sessions' },
    available: [
      { k: 'sessions', label: 'Sessions' },
      { k: 'engagedSessions', label: 'Engaged Sessions' },
      { k: 'engagementRate', label: 'Eng. Rate', suffix: '%' },
      { k: 'avgEngagementTime', label: 'Avg Time', suffix: 's' },
      { k: 'eventsPerSession', label: 'Events / Session' },
      { k: 'eventCount', label: 'Total Events' },
    ],
  },
]

function fmtValue(v: number | null | undefined, prefix?: string, suffix?: string): string {
  if (v === null || v === undefined) return '—'
  return (prefix ?? '') + Number(v).toLocaleString() + (suffix ?? '')
}

function deltaPct(curr: number | null | undefined, prev: number | null | undefined): { pct: number; dir: 'up' | 'down' | 'flat' } | null {
  if (typeof curr !== 'number' || typeof prev !== 'number' || prev === 0) return null
  const d = curr - prev
  if (d === 0) return { pct: 0, dir: 'flat' }
  const pct = Math.round((d / prev) * 100)
  return { pct, dir: d > 0 ? 'up' : 'down' }
}

export function AnalyticsBoard({ series }: { series: ReportSeries[] }) {
  const latest = series[series.length - 1]
  const prev = series.length > 1 ? series[series.length - 2] : null

  return (
    <div className="space-y-6">
      {/* Top KPI row — one per channel using primary metric */}
      <section>
        <h2 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
          Latest snapshot · {latest.periodLabel}
        </h2>
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          {CHANNELS.map((ch) => {
            const cv = latest.metrics?.[ch.k]?.[ch.primary.k]
            const pv = prev?.metrics?.[ch.k]?.[ch.primary.k]
            const d = deltaPct(cv, pv)
            return (
              <div key={ch.k} className={cn('border border-border rounded-lg p-4', ch.bg)}>
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="h-2 w-2 rounded-full" style={{ background: ch.color }} />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    {ch.label}
                  </span>
                </div>
                <div className="text-2xl font-bold tabular-nums">
                  {fmtValue(cv, ch.primary.prefix, ch.primary.suffix)}
                </div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mt-1">
                  {ch.primary.label}
                </div>
                {d ? <DeltaBadge d={d} /> : prev ? <span className="text-[10px] text-muted-foreground italic mt-1 inline-block">no prior data</span> : null}
              </div>
            )
          })}
        </div>
      </section>

      {/* One chart card per channel */}
      <section className="grid gap-4 lg:grid-cols-2">
        {CHANNELS.map((ch) => (
          <ChannelChart key={ch.k} channel={ch} series={series} />
        ))}
      </section>

      {/* Growth matrix — channel × metric table */}
      <GrowthMatrix series={series} />

      {/* Reports timeline */}
      <section className="bg-card border border-border rounded-lg shadow-sm">
        <header className="px-5 py-3.5 border-b border-border">
          <h3 className="font-semibold">Reports timeline</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {series.length} report{series.length !== 1 ? 's' : ''} feeding this dashboard.
          </p>
        </header>
        <ul className="divide-y divide-border">
          {[...series].reverse().map((r) => (
            <li key={r.id} className="flex items-center gap-3 px-5 py-3 hover:bg-accent/30 transition-colors">
              <BarChart3 className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{r.title}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {r.periodLabel} · generated {format(new Date(r.createdAt), 'd LLL yyyy')}
                </p>
              </div>
              <Button asChild variant="ghost" size="sm" className="gap-1.5">
                <Link href={`/marketing/reports?id=${r.id}`}>
                  <Maximize2 className="h-3.5 w-3.5" />
                  Open
                </Link>
              </Button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

function DeltaBadge({ d }: { d: { pct: number; dir: 'up' | 'down' | 'flat' } }) {
  if (d.dir === 'flat') {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold mt-1 text-muted-foreground">
        <Minus className="h-3 w-3" /> no change
      </span>
    )
  }
  const cls = d.dir === 'up' ? 'text-emerald-600' : 'text-red-600'
  const Icon = d.dir === 'up' ? TrendingUp : TrendingDown
  const sign = d.dir === 'up' ? '+' : ''
  return (
    <span className={cn('inline-flex items-center gap-1 text-[11px] font-semibold mt-1', cls)}>
      <Icon className="h-3 w-3" /> {sign}{d.pct}%
      <span className="opacity-60 font-medium">vs prev</span>
    </span>
  )
}

function ChannelChart({ channel, series }: { channel: ChannelDef; series: ReportSeries[] }) {
  const [metricKey, setMetricKey] = useState(channel.primary.k)
  const metric = channel.available.find((m) => m.k === metricKey) ?? channel.primary

  // Build chart data — only points where the value is present
  const data = useMemo(
    () =>
      series
        .map((r) => ({
          label: r.periodLabel,
          createdAt: r.createdAt,
          value: r.metrics?.[channel.k]?.[metricKey],
        }))
        .filter((d) => typeof d.value === 'number'),
    [series, channel.k, metricKey],
  )

  const min = data.length ? Math.min(...data.map((d) => d.value as number)) : 0
  const max = data.length ? Math.max(...data.map((d) => d.value as number)) : 0

  return (
    <div className={cn('border border-border rounded-lg overflow-hidden', channel.bg)}>
      <header className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border bg-card/50">
        <div className="flex items-center gap-2 min-w-0">
          <span className="h-2 w-2 rounded-full shrink-0" style={{ background: channel.color }} />
          <h3 className="font-semibold text-sm">{channel.label}</h3>
        </div>
        <Select value={metricKey} onValueChange={setMetricKey}>
          <SelectTrigger className="h-7 text-xs w-[170px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {channel.available.map((m) => (
              <SelectItem key={m.k} value={m.k} className="text-xs">
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </header>
      <div className="p-4 bg-card">
        {data.length === 0 ? (
          <div className="h-[180px] flex items-center justify-center text-xs text-muted-foreground italic">
            No data for this metric in saved reports
          </div>
        ) : data.length === 1 ? (
          <div className="h-[180px] flex flex-col items-center justify-center">
            <div className="text-3xl font-bold tabular-nums">
              {fmtValue(data[0].value, metric.prefix, metric.suffix)}
            </div>
            <div className="text-xs text-muted-foreground mt-1">{data[0].label}</div>
            <div className="text-[11px] text-muted-foreground italic mt-3">
              Add a second report to draw a trendline.
            </div>
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={false}
                  tickLine={false}
                  width={40}
                  tickFormatter={(v) => {
                    if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + 'M'
                    if (v >= 1_000) return (v / 1_000).toFixed(0) + 'k'
                    return String(v)
                  }}
                />
                <Tooltip
                  formatter={(v: number) => [fmtValue(v, metric.prefix, metric.suffix), metric.label]}
                  contentStyle={{
                    background: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px',
                    fontSize: '11px',
                  }}
                  labelStyle={{ fontWeight: 600, color: 'hsl(var(--foreground))' }}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={channel.color}
                  strokeWidth={2.5}
                  dot={{ fill: channel.color, r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
            <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground tabular-nums">
              <span>min {fmtValue(min, metric.prefix, metric.suffix)}</span>
              <span>{data.length} data points</span>
              <span>max {fmtValue(max, metric.prefix, metric.suffix)}</span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function GrowthMatrix({ series }: { series: ReportSeries[] }) {
  // For each channel × each available metric, compute % change from first to last report
  if (series.length < 2) return null
  const first = series[0]
  const last = series[series.length - 1]
  const periodSpan = `${first.periodLabel} → ${last.periodLabel}`

  return (
    <section className="bg-card border border-border rounded-lg shadow-sm">
      <header className="px-5 py-3.5 border-b border-border">
        <h3 className="font-semibold">Growth matrix</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          % change across the full dataset · {periodSpan}
        </p>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              <th className="text-left px-4 py-2.5">Channel</th>
              <th className="text-left px-4 py-2.5">Metric</th>
              <th className="text-right px-4 py-2.5">First</th>
              <th className="text-right px-4 py-2.5">Latest</th>
              <th className="text-right px-4 py-2.5">Change</th>
            </tr>
          </thead>
          <tbody>
            {CHANNELS.flatMap((ch) =>
              ch.available.map((m) => {
                const fv = first.metrics?.[ch.k]?.[m.k]
                const lv = last.metrics?.[ch.k]?.[m.k]
                if (typeof fv !== 'number' || typeof lv !== 'number') return null
                const d = deltaPct(lv, fv)
                return (
                  <tr key={`${ch.k}-${m.k}`} className="border-b border-border last:border-b-0">
                    <td className="px-4 py-2 font-semibold" style={{ color: ch.color }}>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: ch.color }} />
                        {ch.label}
                      </span>
                    </td>
                    <td className="px-4 py-2">{m.label}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">{fmtValue(fv, m.prefix, m.suffix)}</td>
                    <td className="px-4 py-2 text-right tabular-nums font-semibold">{fmtValue(lv, m.prefix, m.suffix)}</td>
                    <td className="px-4 py-2 text-right">
                      {d ? (
                        <span
                          className={cn(
                            'font-bold tabular-nums',
                            d.dir === 'up' ? 'text-emerald-600' : d.dir === 'down' ? 'text-red-600' : 'text-muted-foreground',
                          )}
                        >
                          {d.dir === 'up' ? '▲ +' : d.dir === 'down' ? '▼ ' : ''}
                          {d.pct}%
                        </span>
                      ) : '—'}
                    </td>
                  </tr>
                )
              }),
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
