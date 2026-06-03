'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Loader2, Upload, FileJson, Check, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { LB_TYPES } from '@/lib/marketing/constants'

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
}

interface ImportResult {
  total: number
  inserted: number
  skipped: number
  failed: number
  skippedKeys: string[]
  failures: { index: number; reason: string }[]
}

const SAMPLE = `[
  { "date": "2026-07-01", "type": "profile" },
  { "date": "2026-07-01", "type": "web20" },
  { "date": "2026-07-01", "type": "crowd" },
  { "date": "2026-07-01", "type": "medium" },
  { "date": "2026-07-01", "type": "article" },
  { "date": "2026-07-01", "type": "market_news" },
  { "date": "2026-07-02", "type": "article" },
  { "date": "2026-07-02", "type": "market_news" }
]`

export function LbImportModal({ open, onOpenChange }: Props) {
  const router = useRouter()
  const [text, setText] = useState('')
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)

  const preview = useMemo(() => {
    if (!text.trim()) return { items: [] as any[], err: null as string | null }
    try {
      const j = JSON.parse(text)
      const arr = Array.isArray(j) ? j : Array.isArray(j?.items) ? j.items : []
      if (arr.length === 0) return { items: [], err: 'JSON parsed but contains no items' }
      return { items: arr, err: null }
    } catch (e: any) {
      return { items: [] as any[], err: e?.message ?? 'Invalid JSON' }
    }
  }, [text])

  const typeSet: Set<string> = new Set(LB_TYPES.map((t) => t.k))
  const previewStats = useMemo(() => {
    if (preview.items.length === 0) return null
    const byType = new Map<string, number>()
    let unknownType = 0
    let badDate = 0
    for (const p of preview.items) {
      byType.set(p.type, (byType.get(p.type) ?? 0) + 1)
      if (p.type && !typeSet.has(p.type)) unknownType++
      if (!p.date || !/^\d{4}-\d{2}-\d{2}/.test(p.date)) badDate++
    }
    return { byType, unknownType, badDate }
  }, [preview.items, typeSet])

  const handleImport = async () => {
    if (preview.items.length === 0) { toast.error('Nothing to import'); return }
    setImporting(true)
    setResult(null)
    try {
      const res = await fetch('/api/marketing/linkbuilding/bulk-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: text,
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data?.error ?? 'Import failed'); return }
      setResult(data)
      toast.success(`Imported ${data.inserted ?? 0} new${data.skipped ? ` · ${data.skipped} already scheduled` : ''}${data.failed ? ` · ${data.failed} failed` : ''}`)
      if (data.inserted > 0) router.refresh()
    } finally { setImporting(false) }
  }

  const fileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => { setText(String(ev.target?.result ?? '')); setResult(null) }
    reader.readAsText(file)
    e.target.value = ''
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-4 w-4" /> Import link-building plan
          </DialogTitle>
          <DialogDescription>
            Paste a JSON array of placement slots (Profile, Web 2.0, Crowd, Medium, Article, Market News, Outreach…) and drop them onto the calendar. Idempotent — re-running the same plan never duplicates rows.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <label className="inline-flex items-center gap-1.5 cursor-pointer text-sm text-muted-foreground hover:text-foreground">
              <input type="file" accept=".json,application/json" onChange={fileUpload} className="hidden" />
              <FileJson className="h-3.5 w-3.5" /> Load from .json file
            </label>
            <span className="text-muted-foreground">·</span>
            <button type="button" className="text-sm text-primary hover:underline" onClick={() => setText(SAMPLE)}>
              Paste a small example
            </button>
            {text ? (
              <button type="button" className="text-sm text-muted-foreground hover:text-destructive ml-auto" onClick={() => { setText(''); setResult(null) }}>
                Clear
              </button>
            ) : null}
          </div>

          <details className="rounded-md border border-border bg-muted/30 p-3">
            <summary className="cursor-pointer text-xs font-semibold">Expected format ▾</summary>
            <div className="mt-2 text-xs text-muted-foreground space-y-1.5">
              <div>JSON array (or <code className="text-[10px]">{`{ "items": [...] }`}</code>). Each item needs at minimum <code className="text-[10px]">date</code> + <code className="text-[10px]">type</code>; everything else is optional.</div>
              <div><strong>Allowed <code className="text-[10px]">type</code> values:</strong></div>
              <div className="flex flex-wrap gap-1">
                {LB_TYPES.map((t) => (
                  <Badge key={t.k} variant="outline" className="text-[10px]"><code>{t.k}</code> · {t.label}</Badge>
                ))}
              </div>
              <div className="mt-2">Optional fields: <code className="text-[10px]">title</code> (auto-generated if missing), <code className="text-[10px]">status</code> (planned / in_progress / followup / published / declined), <code className="text-[10px]">targetSite</code>, <code className="text-[10px]">contactName</code>, <code className="text-[10px]">contactEmail</code>, <code className="text-[10px]">anchorText</code>, <code className="text-[10px]">destinationUrl</code>, <code className="text-[10px]">liveUrl</code>, <code className="text-[10px]">publishedDate</code>, <code className="text-[10px]">dr</code>, <code className="text-[10px]">cost</code>, <code className="text-[10px]">notes</code>.</div>
            </div>
          </details>

          <div>
            <Textarea
              value={text}
              onChange={(e) => { setText(e.target.value); setResult(null) }}
              rows={14}
              placeholder='[ { "date": "2026-07-01", "type": "profile" }, { "date": "2026-07-01", "type": "article" } ]'
              className="font-mono text-xs"
            />
            {preview.err ? (
              <p className="text-xs text-destructive mt-1 inline-flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> {preview.err}
              </p>
            ) : null}
          </div>

          {previewStats ? (
            <div className="rounded-md border border-border bg-card p-3 text-sm">
              <div className="flex items-center gap-2 mb-2 font-semibold">
                <Check className="h-3.5 w-3.5 text-emerald-600" />
                Preview: {preview.items.length} slot{preview.items.length === 1 ? '' : 's'} parsed
              </div>
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className="text-muted-foreground">By type:</span>
                {Array.from(previewStats.byType.entries()).map(([t, n]) => {
                  const known = typeSet.has(t)
                  return (
                    <Badge key={t} variant={known ? 'secondary' : 'destructive'} className="text-[10px]">
                      {t}: {n}{known ? '' : ' (unknown)'}
                    </Badge>
                  )
                })}
              </div>
              {(previewStats.unknownType > 0 || previewStats.badDate > 0) ? (
                <div className="mt-2 text-xs text-amber-700 dark:text-amber-300 space-y-0.5">
                  {previewStats.unknownType > 0 ? <div>⚠ {previewStats.unknownType} item(s) use an unknown type — will fail</div> : null}
                  {previewStats.badDate > 0 ? <div>⚠ {previewStats.badDate} item(s) have an invalid <code className="text-[10px]">date</code></div> : null}
                </div>
              ) : null}
            </div>
          ) : null}

          {result ? (
            <div className="rounded-md border border-emerald-500/40 bg-emerald-500/5 p-3 text-sm space-y-1.5">
              <div className="font-semibold inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-emerald-600" /> Import complete</div>
              <div className="grid grid-cols-4 gap-2 text-xs tabular-nums">
                <div><div className="text-muted-foreground">Total</div><div className="font-bold">{result.total}</div></div>
                <div className="text-emerald-700 dark:text-emerald-300"><div className="text-muted-foreground">New</div><div className="font-bold">{result.inserted}</div></div>
                <div className="text-muted-foreground"><div>Already in cal</div><div className="font-bold">{result.skipped}</div></div>
                <div className="text-destructive"><div>Failed</div><div className="font-bold">{result.failed}</div></div>
              </div>
              {result.failures.length > 0 ? (
                <details className="text-xs">
                  <summary className="cursor-pointer text-destructive">Show {result.failures.length} failure{result.failures.length === 1 ? '' : 's'}</summary>
                  <ul className="mt-1 ml-4 list-disc">
                    {result.failures.map((f, i) => <li key={i}>#{f.index}: {f.reason}</li>)}
                  </ul>
                </details>
              ) : null}
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={importing}>Close</Button>
          <Button
            onClick={handleImport}
            disabled={importing || preview.items.length === 0 || !!preview.err}
            className="gap-1.5"
          >
            {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            {importing ? 'Importing…' : `Import ${preview.items.length || ''} slot${preview.items.length === 1 ? '' : 's'}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
