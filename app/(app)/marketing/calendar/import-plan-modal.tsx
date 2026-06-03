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

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  accountSlugs: { slug: string; name: string }[]
}

interface PreviewItem {
  acc?: string
  accountId?: string
  type: string
  title: string
  content?: string
  platforms?: string[]
  date: string
  status?: string
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
  {
    "acc": "n5",
    "type": "Article",
    "platforms": ["Medium"],
    "title": "What US Buyers Actually Want from EU Licenses",
    "content": "[Track A · Medium] Mon 1. Firsthand signals from SF/LA meetings...",
    "date": "2026-06-01"
  },
  {
    "acc": "ih",
    "type": "Text Post",
    "platforms": ["LinkedIn"],
    "title": "Q2 2026 in one number: 8 events, 14 countries.",
    "content": "[Stat drop] 12pm · Personal.",
    "date": "2026-06-01"
  },
  {
    "acc": "db",
    "type": "Text Post",
    "platforms": ["LinkedIn"],
    "title": "End of Q2 from the banking side.",
    "content": "[Pillar 1 · Banking Reality] 9am.",
    "date": "2026-06-02"
  }
]`

export function ImportPlanModal({ open, onOpenChange, accountSlugs }: Props) {
  const router = useRouter()
  const [text, setText] = useState('')
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)

  // Best-effort parse for the live preview. Doesn't block the user — we let
  // the server do the authoritative validation on Import.
  const preview = useMemo(() => {
    if (!text.trim()) return { items: [] as PreviewItem[], err: null as string | null }
    try {
      const j = JSON.parse(text)
      const arr: PreviewItem[] = Array.isArray(j) ? j : Array.isArray(j?.posts) ? j.posts : []
      if (arr.length === 0) return { items: [], err: 'JSON parsed but contains no posts' }
      return { items: arr, err: null }
    } catch (e: any) {
      return { items: [] as PreviewItem[], err: e?.message ?? 'Invalid JSON' }
    }
  }, [text])

  const slugSet = new Set(accountSlugs.map((a) => a.slug))
  const previewStats = useMemo(() => {
    if (preview.items.length === 0) return null
    const byAcc = new Map<string, number>()
    let unknownAcc = 0
    let badDate = 0
    let missingTitle = 0
    for (const p of preview.items) {
      const key = p.acc ?? p.accountId ?? '?'
      byAcc.set(key, (byAcc.get(key) ?? 0) + 1)
      if (p.acc && !slugSet.has(p.acc)) unknownAcc++
      if (!p.date || !/^\d{4}-\d{2}-\d{2}/.test(p.date)) badDate++
      if (!p.title || !p.title.trim()) missingTitle++
    }
    return { byAcc, unknownAcc, badDate, missingTitle }
  }, [preview.items, slugSet])

  const handleImport = async () => {
    if (preview.items.length === 0) { toast.error('Nothing to import'); return }
    setImporting(true)
    setResult(null)
    try {
      const res = await fetch('/api/marketing/posts/bulk-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: text,
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data?.error ?? 'Import failed'); return }
      setResult(data)
      const success = data.inserted ?? 0
      const dup = data.skipped ?? 0
      const fail = data.failed ?? 0
      toast.success(`Imported ${success} new post${success === 1 ? '' : 's'}${dup ? ` · ${dup} already in calendar` : ''}${fail ? ` · ${fail} failed` : ''}`)
      if (success > 0) router.refresh()
    } finally {
      setImporting(false)
    }
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
            <Upload className="h-4 w-4" /> Import content plan
          </DialogTitle>
          <DialogDescription>
            Paste a JSON array of posts and drop them straight into the calendar. Safe to re-run — posts already scheduled on the same date with the same title are skipped.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <label className="inline-flex items-center gap-1.5 cursor-pointer text-sm text-muted-foreground hover:text-foreground">
              <input type="file" accept=".json,application/json" onChange={fileUpload} className="hidden" />
              <FileJson className="h-3.5 w-3.5" /> Load from .json file
            </label>
            <span className="text-muted-foreground">·</span>
            <button
              type="button"
              className="text-sm text-primary hover:underline"
              onClick={() => setText(SAMPLE)}
            >
              Paste a small example
            </button>
            {text ? (
              <button
                type="button"
                className="text-sm text-muted-foreground hover:text-destructive ml-auto"
                onClick={() => { setText(''); setResult(null) }}
              >
                Clear
              </button>
            ) : null}
          </div>

          <details className="rounded-md border border-border bg-muted/30 p-3">
            <summary className="cursor-pointer text-xs font-semibold">Expected format ▾</summary>
            <div className="mt-2 text-xs text-muted-foreground space-y-1.5">
              <div>JSON array (or <code className="text-[10px]">{`{ "posts": [...] }`}</code>) where each post has:</div>
              <ul className="ml-4 list-disc space-y-1">
                <li><code className="text-[10px]">acc</code> — account slug ({accountSlugs.map((a) => <code key={a.slug} className="text-[10px]">{a.slug}</code>).reduce((acc, v, i) => i === 0 ? [v] : [...acc, ', ', v] as any, [] as any)}), <em>or</em> <code className="text-[10px]">accountId</code></li>
                <li><code className="text-[10px]">type</code> — Article, Reel, Carousel, Text Post, Company Post, Founder Post, Thread, Repost, Story</li>
                <li><code className="text-[10px]">title</code> — short hook</li>
                <li><code className="text-[10px]">content</code> — full body / notes (optional)</li>
                <li><code className="text-[10px]">platforms</code> — array of strings (LinkedIn, Instagram, X/Twitter, Medium, Telegram, etc.)</li>
                <li><code className="text-[10px]">date</code> — <code className="text-[10px]">YYYY-MM-DD</code> (pinned to UTC noon) or full ISO datetime</li>
                <li><code className="text-[10px]">status</code> — idea / wip / done / pub / skip (default: idea)</li>
              </ul>
            </div>
          </details>

          <div>
            <Textarea
              value={text}
              onChange={(e) => { setText(e.target.value); setResult(null) }}
              rows={14}
              placeholder='[ { "acc": "n5", "type": "Article", "platforms": ["Medium"], "title": "...", "date": "2026-06-01" }, ... ]'
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
                Preview: {preview.items.length} post{preview.items.length === 1 ? '' : 's'} parsed
              </div>
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className="text-muted-foreground">By account:</span>
                {Array.from(previewStats.byAcc.entries()).map(([slug, n]) => {
                  const known = slugSet.has(slug)
                  return (
                    <Badge key={slug} variant={known ? 'secondary' : 'destructive'} className="text-[10px]">
                      {slug}: {n}{known ? '' : ' (unknown)'}
                    </Badge>
                  )
                })}
              </div>
              {(previewStats.unknownAcc > 0 || previewStats.badDate > 0 || previewStats.missingTitle > 0) ? (
                <div className="mt-2 text-xs text-amber-700 dark:text-amber-300 space-y-0.5">
                  {previewStats.unknownAcc > 0 ? <div>⚠ {previewStats.unknownAcc} post(s) reference an unknown account slug — will fail</div> : null}
                  {previewStats.badDate > 0 ? <div>⚠ {previewStats.badDate} post(s) have an invalid <code className="text-[10px]">date</code></div> : null}
                  {previewStats.missingTitle > 0 ? <div>⚠ {previewStats.missingTitle} post(s) missing a title</div> : null}
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
            {importing ? 'Importing…' : `Import ${preview.items.length || ''} post${preview.items.length === 1 ? '' : 's'}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
