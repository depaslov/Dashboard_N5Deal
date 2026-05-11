'use client'

import { useState, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { Upload, Sparkles, X, Trash2, BarChart3, FileText, Loader2, Download, ArrowLeftRight, TrendingUp, TrendingDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

interface ReportListItem {
  id: string
  title: string
  periodLabel: string
  createdAt: string
  imgCount: number
}

interface ReportDetail {
  id: string
  title: string
  periodLabel: string
  html: string
  notes: string
  notesByChannel: Record<string, string>
  metrics: Record<string, Record<string, number | null>>
  createdAt: string
}

const CHANNELS: { k: string; label: string }[] = [
  { k: 'overview', label: 'Overview' },
  { k: 'instagram', label: 'Instagram' },
  { k: 'youtube', label: 'YouTube' },
  { k: 'linkedin', label: 'LinkedIn' },
  { k: 'website', label: 'Website' },
  { k: 'compare', label: 'Compare ↔' },
]

interface PreviousReport {
  id: string
  title: string
  periodLabel: string
  metrics: Record<string, Record<string, number | null>>
  createdAt: string
}

const CHANNEL_FIELDS: Record<string, { k: string; label: string; prefix?: string; suffix?: string }[]> = {
  instagram: [
    { k: 'followers', label: 'Followers' },
    { k: 'reach', label: 'Reach' },
    { k: 'impressions', label: 'Impressions' },
    { k: 'engagement', label: 'Engagement' },
    { k: 'profileVisits', label: 'Profile Visits' },
    { k: 'linkTaps', label: 'Link Taps' },
    { k: 'adSpend', label: 'Ad Spend', prefix: '$' },
    { k: 'ctr', label: 'CTR', suffix: '%' },
  ],
  youtube: [
    { k: 'subscribers', label: 'Subscribers' },
    { k: 'views', label: 'Total Views' },
    { k: 'watchTime', label: 'Watch Time', suffix: 'h' },
    { k: 'retention', label: 'Retention', suffix: '%' },
    { k: 'videoViews', label: 'Long-form Views' },
    { k: 'impressions', label: 'Impressions' },
    { k: 'ctr', label: 'Impressions CTR', suffix: '%' },
  ],
  linkedin: [
    { k: 'followers', label: 'Followers' },
    { k: 'impressions', label: 'Impressions' },
    { k: 'organic', label: 'Organic Impr.' },
    { k: 'sponsored', label: 'Sponsored Impr.' },
    { k: 'uniqueReaders', label: 'Unique Readers' },
    { k: 'clicks', label: 'Clicks' },
    { k: 'reactions', label: 'Reactions' },
    { k: 'comments', label: 'Comments' },
    { k: 'engRate', label: 'Eng. Rate', suffix: '%' },
    { k: 'leads', label: 'Leads' },
    { k: 'spend', label: 'Ad Spend', prefix: '$' },
  ],
  website: [
    { k: 'sessions', label: 'Sessions' },
    { k: 'engagedSessions', label: 'Engaged Sessions' },
    { k: 'engagementRate', label: 'Eng. Rate', suffix: '%' },
    { k: 'avgEngagementTime', label: 'Avg Time', suffix: 's' },
    { k: 'eventsPerSession', label: 'Events / Session' },
    { k: 'eventCount', label: 'Total Events' },
  ],
}

export function ReportsBoard({
  reports,
  selected,
  previous,
}: {
  reports: ReportListItem[]
  selected: ReportDetail | null
  previous: PreviousReport | null
}) {
  const router = useRouter()
  const params = useSearchParams()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<{ name: string; dataUrl: string }[]>([])
  const [generating, setGenerating] = useState(false)
  const [title, setTitle] = useState('')
  const [periodLabel, setPeriodLabel] = useState('')
  const [tab, setTab] = useState('overview')

  function selectReport(id: string) {
    const q = new URLSearchParams(params.toString())
    q.set('id', id)
    router.push('/marketing/reports?' + q.toString())
    setTab('overview')
  }

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return
    const arr = Array.from(files).filter((f) => f.type.startsWith('image/'))
    const added: typeof pending = []
    for (const f of arr) {
      try {
        const dataUrl = await fileToDataUrl(f)
        added.push({ name: f.name, dataUrl })
      } catch {
        toast.error(`Could not read ${f.name}`)
      }
    }
    setPending((prev) => [...prev, ...added].slice(0, 9))
  }

  async function generate() {
    if (!pending.length) return
    setGenerating(true)
    try {
      const res = await fetch('/api/marketing/reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          screenshots: pending.map((p) => p.dataUrl),
          title: title || undefined,
          periodLabel: periodLabel || undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data?.error ?? 'Generation failed')
        return
      }
      setPending([])
      setTitle('')
      setPeriodLabel('')
      toast.success('Report generated')
      router.refresh()
      // Navigate to the new report
      if (data.report?.id) {
        const q = new URLSearchParams(params.toString())
        q.set('id', data.report.id)
        router.push('/marketing/reports?' + q.toString())
      }
    } finally {
      setGenerating(false)
    }
  }

  async function deleteReport(id: string) {
    if (!confirm('Delete this report?')) return
    const res = await fetch(`/api/marketing/reports/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      toast.error('Delete failed')
      return
    }
    toast.success('Deleted')
    router.refresh()
    if (selected?.id === id) router.push('/marketing/reports')
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      {/* Sidebar — uploader + list */}
      <aside className="space-y-4">
        <div className="bg-card border border-border rounded-lg shadow-sm">
          <header className="px-4 py-3 border-b border-border">
            <h2 className="font-semibold text-sm">Generate new report</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Drop analytics screenshots — Anthropic Claude reads them and writes the report.
            </p>
          </header>
          <div className="p-3 space-y-3">
            <div
              onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('border-primary', 'bg-primary/5') }}
              onDragLeave={(e) => { e.currentTarget.classList.remove('border-primary', 'bg-primary/5') }}
              onDrop={(e) => {
                e.preventDefault()
                e.currentTarget.classList.remove('border-primary', 'bg-primary/5')
                handleFiles(e.dataTransfer.files)
              }}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-border rounded-lg p-4 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors"
            >
              <Upload className="h-5 w-5 mx-auto text-muted-foreground mb-1.5" />
              <p className="text-xs font-semibold">Drop screenshots here</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Or click to choose · max 9</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                hidden
                onChange={(e) => { handleFiles(e.target.files); e.target.value = '' }}
              />
            </div>

            {pending.length > 0 ? (
              <>
                <div className="grid grid-cols-3 gap-1.5">
                  {pending.map((p, i) => (
                    <div key={i} className="relative aspect-square rounded overflow-hidden border border-border bg-muted">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.dataUrl} alt={p.name} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setPending((prev) => prev.filter((_, idx) => idx !== i)) }}
                        className="absolute top-0.5 right-0.5 h-5 w-5 inline-flex items-center justify-center bg-black/60 text-white rounded text-xs"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="space-y-2">
                  <div>
                    <Label htmlFor="rpt-title" className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Title (optional)</Label>
                    <Input id="rpt-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. May 2026 Marketing Report" className="text-xs h-8" />
                  </div>
                  <div>
                    <Label htmlFor="rpt-period" className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Period (optional)</Label>
                    <Input id="rpt-period" value={periodLabel} onChange={(e) => setPeriodLabel(e.target.value)} placeholder="e.g. May 2026" className="text-xs h-8" />
                  </div>
                </div>

                <Button onClick={generate} disabled={generating} className="w-full gap-1.5">
                  {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  {generating ? 'Analyzing…' : `Generate (${pending.length})`}
                </Button>
                <p className="text-[10px] text-muted-foreground">
                  Generation typically takes 30–90s. The browser cannot show progress — please wait.
                </p>
              </>
            ) : null}
          </div>
        </div>

        {reports.length > 0 ? (
          <div className="bg-card border border-border rounded-lg shadow-sm">
            <header className="px-4 py-3 border-b border-border">
              <h2 className="font-semibold text-sm">Saved reports <span className="text-muted-foreground font-normal">({reports.length})</span></h2>
            </header>
            <ul className="divide-y divide-border">
              {reports.map((r) => (
                <li key={r.id} className={cn('group flex items-center gap-2 px-4 py-2.5', selected?.id === r.id && 'bg-primary/5')}>
                  <button
                    type="button"
                    onClick={() => selectReport(r.id)}
                    className="flex-1 text-left min-w-0"
                  >
                    <div className={cn('text-sm font-medium truncate', selected?.id === r.id && 'text-primary')}>{r.title}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">{r.periodLabel} · {r.imgCount} img</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteReport(r.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7 inline-flex items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-accent"
                    aria-label="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </aside>

      {/* Main detail */}
      <section className="bg-card border border-border rounded-lg shadow-sm min-h-[400px]">
        {selected ? (
          <ReportDetailView report={selected} previous={previous} tab={tab} setTab={setTab} />
        ) : (
          <div className="flex flex-col items-center justify-center text-center py-16 px-6 h-full">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 mb-4">
              <BarChart3 className="h-6 w-6 text-primary" />
            </div>
            <h3 className="font-semibold">No report selected</h3>
            <p className="text-sm text-muted-foreground mt-2 max-w-md">
              Upload screenshots of Instagram Insights, YouTube Studio, LinkedIn Analytics, or Google Analytics
              to auto-generate a structured monthly report. Reports are saved to the workspace.
            </p>
          </div>
        )}
      </section>
    </div>
  )
}

function ReportDetailView({
  report,
  previous,
  tab,
  setTab,
}: {
  report: ReportDetail
  previous: PreviousReport | null
  tab: string
  setTab: (t: string) => void
}) {
  const [savingNotes, setSavingNotes] = useState(false)

  async function saveNotes(notes: string, channel?: string) {
    setSavingNotes(true)
    try {
      const body: Record<string, unknown> = {}
      if (channel) {
        body.notesByChannel = { ...report.notesByChannel, [channel]: notes }
      } else {
        body.notes = notes
      }
      await fetch(`/api/marketing/reports/${report.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    } finally {
      setSavingNotes(false)
    }
  }

  function downloadHtml() {
    const stylesheet = `
      body { font-family: 'Inter', system-ui, sans-serif; max-width: 880px; margin: 2rem auto; padding: 0 2rem; color: #111827; background: #F4F5F7; }
      .rv { background: #fff; border-radius: 12px; padding: 2rem; box-shadow: 0 2px 16px rgba(0,0,0,.08); }
      h1 { font-size: 1.5rem; font-weight: 700; margin-bottom: .25rem; }
      .rp { font-size: .75rem; color: #6B7280; font-weight: 500; margin-bottom: 1rem; padding-bottom: .75rem; border-bottom: 1px solid #E5E7EB; }
      h2 { font-size: 1.15rem; font-weight: 700; margin: 1.5rem 0 .75rem; }
      h3 { font-size: .7rem; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: #6B7280; margin: .85rem 0 .4rem; }
      .mg { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: .5rem; margin: .5rem 0 1rem; }
      .mc { background: #F4F5F7; border: 1px solid #E5E7EB; border-radius: .5rem; padding: .75rem; text-align: center; }
      .mv { font-size: 1.4rem; font-weight: 700; }
      .ml { font-size: .65rem; color: #6B7280; font-weight: 600; margin-top: .15rem; text-transform: uppercase; letter-spacing: .04em; }
      .md.up { color: #059669; font-size: .7rem; font-weight: 600; margin-top: .25rem; }
      .md.dn { color: #DC2626; font-size: .7rem; font-weight: 600; margin-top: .25rem; }
      .ins { background: hsla(217,91%,51%,.08); border-left: 3px solid #2563EB; padding: .6rem .9rem; border-radius: 0 .5rem .5rem 0; font-size: .85rem; margin: .6rem 0; line-height: 1.55; }
      table { width: 100%; border-collapse: collapse; font-size: .8rem; margin: .5rem 0 1rem; }
      th { text-align: left; padding: .4rem .6rem; background: #F4F5F7; border-bottom: 1px solid #E5E7EB; font-size: .65rem; font-weight: 700; color: #6B7280; text-transform: uppercase; letter-spacing: .04em; }
      td { padding: .4rem .6rem; border-bottom: 1px solid #E5E7EB; }
    `
    const fullDoc = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${report.title.replace(/[<>]/g, '')}</title><style>${stylesheet}</style></head><body>${report.html}</body></html>`
    const blob = new Blob([fullDoc], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${report.periodLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-report.html`
    document.body.appendChild(a); a.click(); a.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <header className="px-6 py-4 border-b border-border flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{report.periodLabel}</p>
          <h1 className="font-display text-xl font-semibold tracking-tight mt-0.5">{report.title}</h1>
          <p className="text-xs text-muted-foreground mt-1">Generated {format(new Date(report.createdAt), 'd LLL yyyy, HH:mm')}</p>
        </div>
        <Button variant="outline" size="sm" onClick={downloadHtml} className="gap-1.5 shrink-0">
          <Download className="h-3.5 w-3.5" /> Download
        </Button>
      </header>
      <nav className="flex gap-1 px-6 pt-3 border-b border-border overflow-x-auto" aria-label="Channels">
        {CHANNELS.map((c) => (
          <button
            type="button"
            key={c.k}
            onClick={() => setTab(c.k)}
            className={cn(
              'px-3 py-2 text-xs font-semibold rounded-t border-b-2 -mb-px transition-colors whitespace-nowrap',
              tab === c.k ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {c.label}
          </button>
        ))}
      </nav>
      <div className="p-6 max-h-[75vh] overflow-y-auto">
        {tab === 'overview' ? (
          <>
            <div className="report-html" dangerouslySetInnerHTML={{ __html: report.html }} />
            <div className="mt-6 pt-4 border-t border-border">
              <Label htmlFor="overall-notes" className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Overall notes</Label>
              <Textarea
                id="overall-notes"
                defaultValue={report.notes}
                onBlur={(e) => saveNotes(e.target.value)}
                rows={3}
                placeholder="Action items, summary, what to test next..."
                className="mt-1.5"
              />
            </div>
          </>
        ) : tab === 'compare' ? (
          <CompareTab report={report} previous={previous} />
        ) : (
          <ChannelTab channel={tab} report={report} onSaveNotes={(v) => saveNotes(v, tab)} saving={savingNotes} />
        )}
      </div>
    </>
  )
}

// ============================================================================
// Compare ↔ tab — current vs previous report, deltas across all channels
// ============================================================================

const COMPARE_CHANNELS: { k: string; label: string; color: string; fields: { k: string; label: string; prefix?: string; suffix?: string }[] }[] = [
  {
    k: 'instagram', label: 'Instagram', color: '#E1306C',
    fields: [
      { k: 'followers', label: 'Followers' },
      { k: 'reach', label: 'Reach' },
      { k: 'impressions', label: 'Impressions' },
      { k: 'engagement', label: 'Engagement' },
      { k: 'adSpend', label: 'Ad Spend', prefix: '$' },
      { k: 'ctr', label: 'CTR', suffix: '%' },
    ],
  },
  {
    k: 'youtube', label: 'YouTube', color: '#FF0000',
    fields: [
      { k: 'views', label: 'Views' },
      { k: 'watchTime', label: 'Watch Time', suffix: 'h' },
      { k: 'retention', label: 'Retention', suffix: '%' },
      { k: 'videoViews', label: 'Long-form Views' },
    ],
  },
  {
    k: 'linkedin', label: 'LinkedIn', color: '#0A66C2',
    fields: [
      { k: 'impressions', label: 'Impressions' },
      { k: 'clicks', label: 'Clicks' },
      { k: 'reactions', label: 'Reactions' },
      { k: 'engRate', label: 'Eng. Rate', suffix: '%' },
    ],
  },
  {
    k: 'website', label: 'Website', color: '#E37400',
    fields: [
      { k: 'sessions', label: 'Sessions' },
      { k: 'engagedSessions', label: 'Engaged Sessions' },
      { k: 'engagementRate', label: 'Eng. Rate', suffix: '%' },
      { k: 'avgEngagementTime', label: 'Avg Time', suffix: 's' },
    ],
  },
]

function fmtVal(v: number | null | undefined, prefix?: string, suffix?: string): string {
  if (v === null || v === undefined) return '—'
  return (prefix ?? '') + Number(v).toLocaleString() + (suffix ?? '')
}

function fmtAbsDelta(n: number): string {
  const a = Math.abs(n)
  if (a >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (a >= 1_000) return (n / 1_000).toFixed(1) + 'k'
  return Number.isInteger(n) ? n.toLocaleString() : n.toFixed(1)
}

function CompareTab({ report, previous }: { report: ReportDetail; previous: PreviousReport | null }) {
  if (!previous) {
    return (
      <div className="text-center py-12 text-sm text-muted-foreground">
        <ArrowLeftRight className="h-10 w-10 mx-auto mb-3 opacity-40" />
        <p className="font-medium">Only one report saved</p>
        <p className="mt-1 text-xs max-w-md mx-auto">
          Upload a second report and this tab will show a side-by-side "what went up / what went down"
          summary across all channels — automatically.
        </p>
      </div>
    )
  }

  // Build wins / concerns lists
  const wins: { channel: string; color: string; label: string; prev: string; curr: string; pct: number }[] = []
  const concerns: typeof wins = []

  for (const ch of COMPARE_CHANNELS) {
    for (const f of ch.fields) {
      const cv = report.metrics?.[ch.k]?.[f.k]
      const pv = previous.metrics?.[ch.k]?.[f.k]
      if (typeof cv !== 'number' || typeof pv !== 'number' || pv === 0) continue
      const diff = cv - pv
      const pct = Math.round((diff / pv) * 100)
      if (Math.abs(pct) < 1) continue
      const row = {
        channel: ch.label, color: ch.color, label: f.label,
        prev: fmtVal(pv, f.prefix, f.suffix), curr: fmtVal(cv, f.prefix, f.suffix), pct,
      }
      if (diff > 0) wins.push(row); else concerns.push(row)
    }
  }
  wins.sort((a, b) => b.pct - a.pct)
  concerns.sort((a, b) => a.pct - b.pct)

  return (
    <div className="space-y-6">
      <div className="text-xs text-muted-foreground">
        Comparing <strong className="text-foreground">{previous.periodLabel}</strong> → <strong className="text-foreground">{report.periodLabel}</strong>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 border-l-4 border-l-emerald-600 rounded-lg p-4">
          <h3 className="text-sm font-bold mb-3 flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
            <TrendingUp className="h-4 w-4" /> What went up
            <span className="ml-auto text-[10px] bg-emerald-100 dark:bg-emerald-900 px-1.5 py-0.5 rounded">{wins.length}</span>
          </h3>
          {wins.length === 0 ? (
            <p className="text-xs italic text-muted-foreground">— nothing here —</p>
          ) : (
            <ul className="space-y-1.5 text-xs">
              {wins.map((r, i) => (
                <li key={i} className="flex items-center justify-between gap-2 border-b border-emerald-200/50 dark:border-emerald-900/50 last:border-0 pb-1.5 last:pb-0">
                  <span className="flex items-center gap-1.5 min-w-0">
                    <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: r.color }} />
                    <span className="truncate"><strong>{r.channel}</strong> · {r.label}</span>
                  </span>
                  <span className="font-bold text-emerald-700 dark:text-emerald-300 shrink-0 tabular-nums">+{r.pct}%</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 border-l-4 border-l-red-600 rounded-lg p-4">
          <h3 className="text-sm font-bold mb-3 flex items-center gap-2 text-red-700 dark:text-red-300">
            <TrendingDown className="h-4 w-4" /> What went down
            <span className="ml-auto text-[10px] bg-red-100 dark:bg-red-900 px-1.5 py-0.5 rounded">{concerns.length}</span>
          </h3>
          {concerns.length === 0 ? (
            <p className="text-xs italic text-muted-foreground">— nothing here —</p>
          ) : (
            <ul className="space-y-1.5 text-xs">
              {concerns.map((r, i) => (
                <li key={i} className="flex items-center justify-between gap-2 border-b border-red-200/50 dark:border-red-900/50 last:border-0 pb-1.5 last:pb-0">
                  <span className="flex items-center gap-1.5 min-w-0">
                    <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: r.color }} />
                    <span className="truncate"><strong>{r.channel}</strong> · {r.label}</span>
                  </span>
                  <span className="font-bold text-red-700 dark:text-red-300 shrink-0 tabular-nums">{r.pct}%</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Per-channel detail tables */}
      {COMPARE_CHANNELS.map((ch) => {
        const hasAny = ch.fields.some(
          (f) => report.metrics?.[ch.k]?.[f.k] !== undefined || previous.metrics?.[ch.k]?.[f.k] !== undefined,
        )
        if (!hasAny) return null
        return (
          <div key={ch.k}>
            <h3 className="text-sm font-bold mb-2 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ background: ch.color }} />
              {ch.label}
            </h3>
            <div className="border border-border rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/50 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    <th className="text-left px-3 py-2">Metric</th>
                    <th className="text-right px-3 py-2">{previous.periodLabel}</th>
                    <th className="text-right px-3 py-2">{report.periodLabel}</th>
                    <th className="text-right px-3 py-2">Change</th>
                  </tr>
                </thead>
                <tbody>
                  {ch.fields.map((f) => {
                    const cv = report.metrics?.[ch.k]?.[f.k]
                    const pv = previous.metrics?.[ch.k]?.[f.k]
                    if ((cv === null || cv === undefined) && (pv === null || pv === undefined)) return null
                    let changeNode: React.ReactNode = '—'
                    if (typeof cv === 'number' && typeof pv === 'number' && pv !== 0) {
                      const d = cv - pv
                      const p = Math.round((d / pv) * 100)
                      const cls = d > 0 ? 'text-emerald-600' : d < 0 ? 'text-red-600' : 'text-muted-foreground'
                      const arrow = d > 0 ? '▲' : d < 0 ? '▼' : '—'
                      const sign = d > 0 ? '+' : ''
                      changeNode = (
                        <span className={cn('font-bold tabular-nums', cls)}>
                          {arrow} {sign}{p}%
                          <span className="opacity-60 font-medium text-[10px] ml-1">({sign}{fmtAbsDelta(d)})</span>
                        </span>
                      )
                    }
                    return (
                      <tr key={f.k} className="border-t border-border">
                        <td className="px-3 py-2">{f.label}</td>
                        <td className="text-right px-3 py-2 tabular-nums text-muted-foreground">{fmtVal(pv, f.prefix, f.suffix)}</td>
                        <td className="text-right px-3 py-2 tabular-nums font-semibold">{fmtVal(cv, f.prefix, f.suffix)}</td>
                        <td className="text-right px-3 py-2">{changeNode}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ChannelTab({
  channel,
  report,
  onSaveNotes,
  saving,
}: {
  channel: string
  report: ReportDetail
  onSaveNotes: (notes: string) => void
  saving: boolean
}) {
  const fields = CHANNEL_FIELDS[channel] ?? []
  const data = report.metrics?.[channel] ?? {}
  const noteVal = report.notesByChannel?.[channel] ?? ''
  const hasMetrics = fields.some((f) => data?.[f.k] !== null && data?.[f.k] !== undefined)

  return (
    <div className="space-y-6">
      {hasMetrics ? (
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
          {fields.map((f) => {
            const v = data?.[f.k]
            if (v === null || v === undefined) return null
            return (
              <div key={f.k} className="bg-muted/30 border border-border rounded-lg p-3 text-center">
                <div className="text-xl font-bold tabular-nums">
                  {f.prefix ?? ''}{typeof v === 'number' ? v.toLocaleString() : v}{f.suffix ?? ''}
                </div>
                <div className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground mt-1">{f.label}</div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="text-sm text-muted-foreground text-center py-8">
          No structured metrics extracted for this channel.
        </div>
      )}

      <div>
        <Label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          {channel.charAt(0).toUpperCase() + channel.slice(1)} notes {saving ? '· saving…' : ''}
        </Label>
        <Textarea
          defaultValue={noteVal}
          onBlur={(e) => onSaveNotes(e.target.value)}
          rows={4}
          placeholder={`Observations specific to ${channel} — top posts, what worked, what to test...`}
          className="mt-1.5"
        />
      </div>
    </div>
  )
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(new Error('FileReader failed'))
    r.readAsDataURL(file)
  })
}
