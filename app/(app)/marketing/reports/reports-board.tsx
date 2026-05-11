'use client'

import { useState, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { Upload, Sparkles, X, Trash2, BarChart3, FileText, Loader2 } from 'lucide-react'
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
]

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
}: {
  reports: ReportListItem[]
  selected: ReportDetail | null
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
          <ReportDetailView report={selected} tab={tab} setTab={setTab} />
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
  tab,
  setTab,
}: {
  report: ReportDetail
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

  return (
    <>
      <header className="px-6 py-4 border-b border-border">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{report.periodLabel}</p>
        <h1 className="font-display text-xl font-semibold tracking-tight mt-0.5">{report.title}</h1>
        <p className="text-xs text-muted-foreground mt-1">Generated {format(new Date(report.createdAt), 'd LLL yyyy, HH:mm')}</p>
      </header>
      <nav className="flex gap-1 px-6 pt-3 border-b border-border" aria-label="Channels">
        {CHANNELS.map((c) => (
          <button
            type="button"
            key={c.k}
            onClick={() => setTab(c.k)}
            className={cn(
              'px-3 py-2 text-xs font-semibold rounded-t border-b-2 -mb-px transition-colors',
              tab === c.k ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {c.label}
          </button>
        ))}
      </nav>
      <div className="p-6 max-h-[75vh] overflow-y-auto">
        {tab === 'overview' ? (
          <div className="report-html" dangerouslySetInnerHTML={{ __html: report.html }} />
        ) : (
          <ChannelTab channel={tab} report={report} onSaveNotes={(v) => saveNotes(v, tab)} saving={savingNotes} />
        )}
        {tab === 'overview' ? (
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
        ) : null}
      </div>
    </>
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
