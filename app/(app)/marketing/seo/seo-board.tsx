'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { toast } from 'sonner'
import {
  Plus, TrendingUp, TrendingDown, Minus, Trash2, Search, ExternalLink, Clipboard, Target,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SEO_INTENTS, SEO_LOCALES, SEO_CLUSTERS_SUGGESTED, seoPositionBadge } from '@/lib/marketing/constants'
import { cn } from '@/lib/utils'

export interface SeoKeywordRow {
  id: string
  keyword: string
  targetUrl: string
  currentUrl: string
  position: number | null
  previousPosition: number | null
  impressions: number | null
  clicks: number | null
  volume: number | null
  difficulty: number | null
  cluster: string
  intent: string
  locale: string
  isActive: boolean
  notes: string
  lastChecked: string | null
}

type Mode =
  | { kind: 'create' }
  | { kind: 'edit'; row: SeoKeywordRow }
  | { kind: 'bulk' }
  | null

export function SeoBoard({ items }: { items: SeoKeywordRow[] }) {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>(null)
  const [search, setSearch] = useState('')
  const [clusterFilter, setClusterFilter] = useState<string>('all')
  const [intentFilter, setIntentFilter] = useState<string>('all')

  const clusters = useMemo(() => {
    const set = new Set<string>()
    items.forEach((i) => { if (i.cluster) set.add(i.cluster) })
    SEO_CLUSTERS_SUGGESTED.forEach((c) => set.add(c))
    return [...set].sort()
  }, [items])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return items.filter((i) => {
      if (clusterFilter !== 'all' && i.cluster !== clusterFilter) return false
      if (intentFilter !== 'all' && i.intent !== intentFilter) return false
      if (q && !(i.keyword.toLowerCase().includes(q) || i.targetUrl.toLowerCase().includes(q))) return false
      return true
    })
  }, [items, search, clusterFilter, intentFilter])

  // Summary KPIs — computed on the full set (not filtered) so the picture stays whole.
  const summary = useMemo(() => {
    const total = items.length
    const ranked = items.filter((i) => typeof i.position === 'number')
    const top3 = ranked.filter((i) => (i.position ?? 999) <= 3).length
    const top10 = ranked.filter((i) => (i.position ?? 999) <= 10).length
    const avgPos = ranked.length
      ? Math.round(ranked.reduce((s, i) => s + (i.position ?? 0), 0) / ranked.length)
      : null
    const up = items.filter((i) => typeof i.position === 'number' && typeof i.previousPosition === 'number' && (i.previousPosition ?? 0) > (i.position ?? 0)).length
    const down = items.filter((i) => typeof i.position === 'number' && typeof i.previousPosition === 'number' && (i.previousPosition ?? 0) < (i.position ?? 0)).length
    return { total, top3, top10, avgPos, up, down }
  }, [items])

  // Top movers — sort by delta magnitude
  const movers = useMemo(() => {
    const withDelta = items
      .filter((i) => typeof i.position === 'number' && typeof i.previousPosition === 'number' && i.position !== i.previousPosition)
      .map((i) => ({ ...i, delta: (i.previousPosition ?? 0) - (i.position ?? 0) }))
    const winners = withDelta.filter((i) => i.delta > 0).sort((a, b) => b.delta - a.delta).slice(0, 5)
    const losers = withDelta.filter((i) => i.delta < 0).sort((a, b) => a.delta - b.delta).slice(0, 5)
    return { winners, losers }
  }, [items])

  async function quickUpdatePosition(id: string, newPos: number | null) {
    const res = await fetch(`/api/marketing/seo/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ position: newPos }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      toast.error(data?.error ?? 'Update failed')
      return
    }
    router.refresh()
  }

  if (items.length === 0) {
    return (
      <>
        <EmptyState onAdd={() => setMode({ kind: 'create' })} onBulk={() => setMode({ kind: 'bulk' })} />
        <FormModal mode={mode} clusters={clusters} onClose={() => setMode(null)} />
      </>
    )
  }

  return (
    <div className="space-y-4">
      {/* Summary KPIs */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-6">
        <KpiCard label="Tracked" value={summary.total} />
        <KpiCard label="Top 3" value={summary.top3} accent="text-emerald-600" />
        <KpiCard label="Top 10" value={summary.top10} accent="text-blue-600" />
        <KpiCard label="Avg position" value={summary.avgPos ?? '—'} />
        <KpiCard label="Moving up" value={summary.up} accent="text-emerald-600" icon={<TrendingUp className="h-3.5 w-3.5" />} />
        <KpiCard label="Moving down" value={summary.down} accent="text-red-600" icon={<TrendingDown className="h-3.5 w-3.5" />} />
      </div>

      {/* Top movers */}
      {(movers.winners.length > 0 || movers.losers.length > 0) ? (
        <div className="grid gap-3 md:grid-cols-2">
          <MoverCard variant="winners" items={movers.winners} />
          <MoverCard variant="losers" items={movers.losers} />
        </div>
      ) : null}

      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search keyword or URL..."
            className="h-9 pl-8 w-[260px]"
          />
        </div>
        <Select value={clusterFilter} onValueChange={setClusterFilter}>
          <SelectTrigger className="h-9 w-[160px]"><SelectValue placeholder="Cluster" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All clusters</SelectItem>
            {clusters.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={intentFilter} onValueChange={setIntentFilter}>
          <SelectTrigger className="h-9 w-[160px]"><SelectValue placeholder="Intent" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All intents</SelectItem>
            {SEO_INTENTS.map((i) => <SelectItem key={i.k} value={i.k}>{i.label}</SelectItem>)}
          </SelectContent>
        </Select>

        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" onClick={() => setMode({ kind: 'bulk' })} className="gap-1.5">
            <Clipboard className="h-3.5 w-3.5" /> Bulk import
          </Button>
          <Button onClick={() => setMode({ kind: 'create' })}>
            <Plus className="h-4 w-4 mr-1.5" /> Add keyword
          </Button>
        </div>
      </div>

      {/* Keywords table */}
      <KeywordsTable items={filtered} onEdit={(row) => setMode({ kind: 'edit', row })} onQuickUpdate={quickUpdatePosition} />

      <FormModal mode={mode} clusters={clusters} onClose={() => setMode(null)} />
    </div>
  )
}

function KpiCard({
  label,
  value,
  hint,
  accent,
  icon,
}: { label: string; value: number | string; hint?: string; accent?: string; icon?: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-lg p-3">
      <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1">
        {icon}
        {label}
      </div>
      <div className={cn('text-xl font-bold mt-1 tabular-nums', accent)}>{value}</div>
      {hint ? <div className="text-[10px] text-muted-foreground mt-0.5">{hint}</div> : null}
    </div>
  )
}

function MoverCard({
  variant,
  items,
}: { variant: 'winners' | 'losers'; items: (SeoKeywordRow & { delta: number })[] }) {
  const isWin = variant === 'winners'
  const cls = isWin
    ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900 border-l-4 border-l-emerald-600'
    : 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900 border-l-4 border-l-red-600'
  const Icon = isWin ? TrendingUp : TrendingDown
  const title = isWin ? 'Biggest gainers' : 'Biggest losers'
  const numberCls = isWin ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'
  return (
    <div className={cn('border rounded-lg p-4', cls)}>
      <h3 className={cn('text-sm font-bold mb-3 flex items-center gap-2', numberCls)}>
        <Icon className="h-4 w-4" /> {title}
        <span className={cn('ml-auto text-[10px] px-1.5 py-0.5 rounded font-bold', isWin ? 'bg-emerald-100 dark:bg-emerald-900' : 'bg-red-100 dark:bg-red-900')}>{items.length}</span>
      </h3>
      {items.length === 0 ? (
        <p className="text-xs italic text-muted-foreground">— nothing here —</p>
      ) : (
        <ul className="space-y-1.5 text-xs">
          {items.map((it) => (
            <li key={it.id} className="flex items-center justify-between gap-2 border-b border-border/50 last:border-0 pb-1.5 last:pb-0">
              <span className="truncate">
                <strong>{it.keyword}</strong>
                <span className="text-muted-foreground tabular-nums ml-1">
                  {it.previousPosition} → {it.position}
                </span>
              </span>
              <span className={cn('font-bold tabular-nums shrink-0', numberCls)}>
                {it.delta > 0 ? '+' : ''}{it.delta}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function KeywordsTable({
  items,
  onEdit,
  onQuickUpdate,
}: {
  items: SeoKeywordRow[]
  onEdit: (row: SeoKeywordRow) => void
  onQuickUpdate: (id: string, newPos: number | null) => void
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card py-12 text-center text-sm text-muted-foreground">
        No keywords match the current filter.
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-border bg-card shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              <th className="text-left px-4 py-2.5">Keyword</th>
              <th className="text-left px-4 py-2.5">Target URL</th>
              <th className="text-center px-4 py-2.5">Position</th>
              <th className="text-center px-4 py-2.5">Δ</th>
              <th className="text-right px-4 py-2.5">Volume</th>
              <th className="text-right px-4 py-2.5">KD</th>
              <th className="text-left px-4 py-2.5">Cluster</th>
              <th className="text-left px-4 py-2.5">Updated</th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => {
              const delta = typeof i.position === 'number' && typeof i.previousPosition === 'number'
                ? i.previousPosition - i.position
                : null
              return (
                <tr
                  key={i.id}
                  onClick={() => onEdit(i)}
                  className="border-b border-border last:border-b-0 cursor-pointer hover:bg-accent/30 transition-colors"
                >
                  <td className="px-4 py-2.5">
                    <div className="font-medium max-w-md">{i.keyword}</div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Badge variant="secondary" className="text-[10px] capitalize">{i.intent}</Badge>
                      {i.locale !== 'global' ? (
                        <Badge variant="outline" className="text-[10px] uppercase">{i.locale}</Badge>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    {i.targetUrl ? (
                      <a
                        href={i.targetUrl}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-xs text-primary inline-flex items-center gap-1 truncate max-w-[220px]"
                      >
                        <ExternalLink className="h-3 w-3 shrink-0" />
                        <span className="truncate">{i.targetUrl.replace(/^https?:\/\//, '')}</span>
                      </a>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                    <QuickPositionInput value={i.position} onChange={(v) => onQuickUpdate(i.id, v)} />
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    {delta !== null ? (
                      delta === 0 ? (
                        <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
                          <Minus className="h-3 w-3" /> 0
                        </span>
                      ) : delta > 0 ? (
                        <span className="inline-flex items-center gap-0.5 text-xs font-bold text-emerald-600">
                          <TrendingUp className="h-3 w-3" /> +{delta}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-0.5 text-xs font-bold text-red-600">
                          <TrendingDown className="h-3 w-3" /> {delta}
                        </span>
                      )
                    ) : <span className="text-xs text-muted-foreground italic">—</span>}
                  </td>
                  <td className="px-4 py-2.5 text-right text-xs tabular-nums text-muted-foreground">
                    {i.volume !== null ? i.volume.toLocaleString() : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-right text-xs tabular-nums text-muted-foreground">{i.difficulty ?? '—'}</td>
                  <td className="px-4 py-2.5">
                    {i.cluster ? <Badge variant="outline" className="text-[10px]">{i.cluster}</Badge> : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                    {i.lastChecked ? format(new Date(i.lastChecked), 'd LLL') : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function QuickPositionInput({
  value,
  onChange,
}: { value: number | null; onChange: (v: number | null) => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value !== null ? String(value) : '')

  function commit() {
    setEditing(false)
    const parsed = draft.trim() === '' ? null : parseInt(draft, 10)
    if (parsed !== null && (isNaN(parsed) || parsed < 1 || parsed > 200)) return
    if (parsed !== value) onChange(parsed)
  }

  if (editing) {
    return (
      <input
        autoFocus
        type="number"
        min="1"
        max="200"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') { setDraft(value !== null ? String(value) : ''); setEditing(false) }
        }}
        className="h-7 w-16 px-2 text-center text-sm border border-primary rounded bg-background focus:outline-none focus:ring-2 focus:ring-ring"
      />
    )
  }

  return (
    <button
      type="button"
      onClick={() => { setDraft(value !== null ? String(value) : ''); setEditing(true) }}
      className={cn(
        'inline-flex items-center justify-center h-7 min-w-[44px] px-2 rounded text-sm font-bold tabular-nums',
        seoPositionBadge(value),
      )}
    >
      {value !== null ? value : '—'}
    </button>
  )
}

function EmptyState({ onAdd, onBulk }: { onAdd: () => void; onBulk: () => void }) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-card py-16 px-6 text-center">
      <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 mb-4">
        <Target className="h-6 w-6 text-primary" />
      </div>
      <h3 className="font-semibold">No SEO keywords tracked yet</h3>
      <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
        Track the keywords pages on n5deal.com are targeting, paste positions from Ahrefs / SEMrush
        / GSC weekly, and watch which keywords are pulling you up and which down.
      </p>
      <div className="mt-5 flex items-center justify-center gap-2">
        <Button variant="outline" onClick={onBulk} className="gap-1.5">
          <Clipboard className="h-3.5 w-3.5" /> Bulk import
        </Button>
        <Button onClick={onAdd}>
          <Plus className="h-4 w-4 mr-1.5" /> Add first keyword
        </Button>
      </div>
    </div>
  )
}

// =============================================================================
// FORM MODAL — Create / Edit / Bulk import
// =============================================================================

function FormModal({
  mode,
  clusters,
  onClose,
}: {
  mode: Mode
  clusters: string[]
  onClose: () => void
}) {
  if (!mode) return null
  if (mode.kind === 'bulk') return <BulkImportModal onClose={onClose} />
  return <SingleFormModal mode={mode} clusters={clusters} onClose={onClose} />
}

function SingleFormModal({
  mode,
  clusters,
  onClose,
}: {
  mode: { kind: 'create' } | { kind: 'edit'; row: SeoKeywordRow }
  clusters: string[]
  onClose: () => void
}) {
  const router = useRouter()
  const isEdit = mode.kind === 'edit'
  const initial = isEdit ? mode.row : null

  const [keyword, setKeyword] = useState(initial?.keyword ?? '')
  const [targetUrl, setTargetUrl] = useState(initial?.targetUrl ?? '')
  const [currentUrl, setCurrentUrl] = useState(initial?.currentUrl ?? '')
  const [position, setPosition] = useState(initial?.position !== null && initial?.position !== undefined ? String(initial.position) : '')
  const [impressions, setImpressions] = useState(initial?.impressions !== null && initial?.impressions !== undefined ? String(initial.impressions) : '')
  const [clicks, setClicks] = useState(initial?.clicks !== null && initial?.clicks !== undefined ? String(initial.clicks) : '')
  const [volume, setVolume] = useState(initial?.volume !== null && initial?.volume !== undefined ? String(initial.volume) : '')
  const [difficulty, setDifficulty] = useState(initial?.difficulty !== null && initial?.difficulty !== undefined ? String(initial.difficulty) : '')
  const [cluster, setCluster] = useState(initial?.cluster ?? '')
  const [intent, setIntent] = useState(initial?.intent ?? 'informational')
  const [locale, setLocale] = useState(initial?.locale ?? 'global')
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function save() {
    if (!keyword.trim()) { toast.error('Keyword is required'); return }
    setSaving(true)
    try {
      const body = {
        keyword: keyword.trim(),
        targetUrl: targetUrl.trim() || null,
        currentUrl: currentUrl.trim() || null,
        position: position.trim() === '' ? null : parseInt(position, 10),
        impressions: impressions.trim() === '' ? null : parseInt(impressions, 10),
        clicks: clicks.trim() === '' ? null : parseInt(clicks, 10),
        volume: volume.trim() === '' ? null : parseInt(volume, 10),
        difficulty: difficulty.trim() === '' ? null : parseInt(difficulty, 10),
        cluster: cluster.trim() || null,
        intent,
        locale,
        notes: notes.trim() || null,
      }
      const url = isEdit ? `/api/marketing/seo/${initial!.id}` : '/api/marketing/seo'
      const method = isEdit ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(data?.error ?? 'Save failed'); return }
      toast.success(isEdit ? 'Updated' : 'Added')
      router.refresh(); onClose()
    } finally { setSaving(false) }
  }

  async function remove() {
    if (!isEdit) return
    if (!confirm('Delete this keyword?')) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/marketing/seo/${initial!.id}`, { method: 'DELETE' })
      if (!res.ok) { toast.error('Delete failed'); return }
      toast.success('Deleted')
      router.refresh(); onClose()
    } finally { setDeleting(false) }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit keyword' : 'Add keyword'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="seo-kw">Keyword <span className="text-destructive">*</span></Label>
            <Input id="seo-kw" value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="e.g. emi license cyprus" />
          </div>

          <div>
            <Label htmlFor="seo-target">Target URL on n5deal.com</Label>
            <Input id="seo-target" value={targetUrl} onChange={(e) => setTargetUrl(e.target.value)} placeholder="https://n5deal.com/emi-license" />
          </div>

          {isEdit ? (
            <div>
              <Label htmlFor="seo-current">Currently ranking URL <span className="text-muted-foreground font-normal text-[10px]">(if different)</span></Label>
              <Input id="seo-current" value={currentUrl} onChange={(e) => setCurrentUrl(e.target.value)} placeholder="https://n5deal.com/different-page" />
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="seo-pos">Current position <span className="text-muted-foreground font-normal text-[10px]">(1–100)</span></Label>
              <Input id="seo-pos" type="number" min="1" max="200" value={position} onChange={(e) => setPosition(e.target.value)} placeholder="—" />
            </div>
            <div>
              <Label htmlFor="seo-volume">Monthly volume</Label>
              <Input id="seo-volume" type="number" min="0" value={volume} onChange={(e) => setVolume(e.target.value)} placeholder="—" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label htmlFor="seo-imp">Impressions</Label>
              <Input id="seo-imp" type="number" min="0" value={impressions} onChange={(e) => setImpressions(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="seo-clicks">Clicks</Label>
              <Input id="seo-clicks" type="number" min="0" value={clicks} onChange={(e) => setClicks(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="seo-kd">Difficulty <span className="text-muted-foreground font-normal text-[10px]">(0–100)</span></Label>
              <Input id="seo-kd" type="number" min="0" max="100" value={difficulty} onChange={(e) => setDifficulty(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="seo-cluster">Cluster</Label>
              <Input
                id="seo-cluster"
                value={cluster}
                onChange={(e) => setCluster(e.target.value)}
                placeholder="EMI / PSP / Crypto / ..."
                list="cluster-suggestions"
              />
              <datalist id="cluster-suggestions">
                {clusters.map((c) => <option key={c} value={c} />)}
              </datalist>
            </div>
            <div>
              <Label htmlFor="seo-intent">Intent</Label>
              <Select value={intent} onValueChange={setIntent}>
                <SelectTrigger id="seo-intent"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SEO_INTENTS.map((i) => <SelectItem key={i.k} value={i.k}>{i.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="seo-locale">Locale</Label>
            <Select value={locale} onValueChange={setLocale}>
              <SelectTrigger id="seo-locale" className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {SEO_LOCALES.map((l) => <SelectItem key={l.k} value={l.k}>{l.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="seo-notes">Notes</Label>
            <Textarea id="seo-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Tactics, observations, history..." />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          {isEdit ? (
            <Button variant="destructive" onClick={remove} disabled={saving || deleting} className="mr-auto gap-1.5">
              <Trash2 className="h-3.5 w-3.5" /> {deleting ? 'Deleting…' : 'Delete'}
            </Button>
          ) : null}
          <Button variant="outline" onClick={onClose} disabled={saving || deleting}>Cancel</Button>
          <Button onClick={save} disabled={saving || deleting}>{saving ? 'Saving…' : isEdit ? 'Save changes' : 'Add keyword'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// =============================================================================
// BULK IMPORT — paste lines like "keyword,position,volume,cluster,targetUrl"
// =============================================================================

function BulkImportModal({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)

  function parseLines(): { keyword: string; position: number | null; volume: number | null; cluster: string | null; targetUrl: string | null }[] {
    return text.split('\n').map((line) => {
      const trimmed = line.trim()
      if (!trimmed) return null
      // CSV / TSV friendly — split on tabs OR commas
      const parts = trimmed.split(/\t|,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map((s) => s.trim().replace(/^"|"$/g, ''))
      const [keyword, position, volume, cluster, targetUrl] = parts
      if (!keyword) return null
      return {
        keyword,
        position: position && /^\d+$/.test(position) ? parseInt(position, 10) : null,
        volume: volume && /^\d+$/.test(volume) ? parseInt(volume, 10) : null,
        cluster: cluster || null,
        targetUrl: targetUrl || null,
      }
    }).filter(Boolean) as { keyword: string; position: number | null; volume: number | null; cluster: string | null; targetUrl: string | null }[]
  }

  const preview = useMemo(() => parseLines(), [text])

  async function importAll() {
    if (preview.length === 0) { toast.error('Nothing to import'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/marketing/seo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: preview }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(data?.error ?? 'Import failed'); return }
      toast.success(`Imported · created ${data.created}, updated ${data.updated}`)
      router.refresh(); onClose()
    } finally { setSaving(false) }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk import keywords</DialogTitle>
          <DialogDescription>
            One keyword per line. Format: <code className="text-[11px] bg-muted px-1 rounded">keyword, position, volume, cluster, targetUrl</code>
            <br />Only the keyword is required; other columns are optional. Use commas or tabs (paste from Sheets/Excel works).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={12}
            placeholder={`emi license cyprus, 14, 880, EMI, https://n5deal.com/emi-license\npsp license malta, 23, 420, PSP, https://n5deal.com/psp-license\nvasp license lithuania, , 320, VASP,`}
            className="font-mono text-xs"
          />

          {preview.length > 0 ? (
            <div className="rounded border border-border bg-muted/30 p-2 text-xs">
              <div className="font-semibold mb-1">{preview.length} keyword{preview.length !== 1 ? 's' : ''} parsed</div>
              <div className="max-h-32 overflow-y-auto space-y-0.5">
                {preview.slice(0, 8).map((p, i) => (
                  <div key={i} className="text-muted-foreground truncate">
                    <strong className="text-foreground">{p.keyword}</strong>
                    {p.position !== null ? ` · #${p.position}` : ''}
                    {p.volume !== null ? ` · vol ${p.volume.toLocaleString()}` : ''}
                    {p.cluster ? ` · ${p.cluster}` : ''}
                  </div>
                ))}
                {preview.length > 8 ? <div className="text-muted-foreground">…and {preview.length - 8} more</div> : null}
              </div>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={importAll} disabled={saving || preview.length === 0}>
            {saving ? 'Importing…' : `Import ${preview.length || ''}`.trim()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
