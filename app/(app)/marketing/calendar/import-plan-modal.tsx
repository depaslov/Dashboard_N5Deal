'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Loader2, Upload, FileJson, Check, AlertTriangle, FileUp, Sparkles, FileText, X } from 'lucide-react'
import { cn } from '@/lib/utils'
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
  wiped?: number
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

type SourceMode = 'json' | 'doc'
interface PendingDoc { name: string; kind: 'html' | 'markdown' | 'text' | 'pdf'; content: string }

export function ImportPlanModal({ open, onOpenChange, accountSlugs }: Props) {
  const router = useRouter()
  const [text, setText] = useState('')
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  // Doc-extract mode state.
  const [sourceMode, setSourceMode] = useState<SourceMode>('json')
  const [pendingDoc, setPendingDoc] = useState<PendingDoc | null>(null)
  const [pastedDoc, setPastedDoc] = useState('')
  const [extracting, setExtracting] = useState(false)
  // When the operator wants to wipe + re-insert (e.g. "delete the old June
  // plan and replace it with this one") this flag rides on the bulk-import
  // call. Server-side it deletes every post for the AFFECTED accounts in
  // the payload's date span before inserting; see bulk-import/route.ts.
  const [replaceInRange, setReplaceInRange] = useState(false)

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

  // Read a chosen doc into the pendingDoc state. Same file-type detection
  // pattern the Reports importer uses; PDFs go as base64 data URLs because
  // pdf-parse runs server-side.
  async function handleDocFile(file: File | null) {
    if (!file) return
    const name = file.name.toLowerCase()
    const isPdf = name.endsWith('.pdf') || file.type === 'application/pdf'
    const isHtml = name.endsWith('.html') || name.endsWith('.htm') || file.type === 'text/html'
    const isMd = name.endsWith('.md') || name.endsWith('.markdown') || file.type === 'text/markdown'
    const isTxt = name.endsWith('.txt') || file.type === 'text/plain'
    if (!isPdf && !isHtml && !isMd && !isTxt) { toast.error('Supported: .html, .md, .pdf, .txt'); return }
    try {
      if (isPdf) {
        const dataUrl: string = await new Promise((resolve, reject) => {
          const r = new FileReader()
          r.onload = () => resolve(String(r.result))
          r.onerror = () => reject(new Error('FileReader failed'))
          r.readAsDataURL(file)
        })
        setPendingDoc({ name: file.name, kind: 'pdf', content: dataUrl })
      } else {
        const content = await file.text()
        const kind: PendingDoc['kind'] = isHtml ? 'html' : isMd ? 'markdown' : 'text'
        setPendingDoc({ name: file.name, kind, content })
      }
      setPastedDoc('')
    } catch { toast.error(`Could not read ${file.name}`) }
  }

  // Ship the doc to /extract → LLM returns a JSON array → we drop the
  // array straight into the JSON textarea and switch the mode to "json"
  // so the operator can review before hitting Import. Existing bulk-import
  // does the actual dedup (skip if date|title is already on the calendar).
  async function extractFromDoc() {
    const fromPaste = !pendingDoc && pastedDoc.trim().length > 20
    if (!pendingDoc && !fromPaste) { toast.error('Pick a file or paste a doc first'); return }
    setExtracting(true)
    try {
      const body: Record<string, unknown> = {}
      if (pendingDoc?.kind === 'pdf') {
        body.kind = 'pdf'; body.dataUrl = pendingDoc.content
      } else if (pendingDoc) {
        body.kind = pendingDoc.kind; body.content = pendingDoc.content
      } else {
        const trimmed = pastedDoc.trim()
        body.kind = trimmed.startsWith('<') ? 'html' : /^#{1,6}\s|\n#{1,6}\s/.test(trimmed) ? 'markdown' : 'text'
        body.content = pastedDoc
      }
      const res = await fetch('/api/marketing/posts/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(data?.error ?? 'Extract failed'); return }
      const posts = Array.isArray(data?.posts) ? data.posts : []
      if (posts.length === 0) {
        toast.error('AI couldn\'t find any posts in the doc.')
        return
      }
      setText(JSON.stringify(posts, null, 2))
      setSourceMode('json')
      setPendingDoc(null)
      setPastedDoc('')
      toast.success(`Extracted ${posts.length} post${posts.length === 1 ? '' : 's'} — review and import.`)
    } finally { setExtracting(false) }
  }

  const handleImport = async () => {
    if (preview.items.length === 0) { toast.error('Nothing to import'); return }
    if (replaceInRange) {
      const ok = window.confirm(
        `This will DELETE every existing post for the accounts in this plan within the plan's date range, then insert the ${preview.items.length} new post(s).\n\nContinue?`,
      )
      if (!ok) return
    }
    setImporting(true)
    setResult(null)
    try {
      // When replaceInRange is on we switch the body shape from a bare
      // array to the wrapper object so we can carry the flag. Server-side
      // accepts both shapes.
      const body = replaceInRange
        ? JSON.stringify({ posts: preview.items, replaceInRange: true })
        : text
      const res = await fetch('/api/marketing/posts/bulk-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data?.error ?? 'Import failed'); return }
      setResult(data)
      const success = data.inserted ?? 0
      const dup = data.skipped ?? 0
      const fail = data.failed ?? 0
      const wiped: number = data.wiped ?? 0
      toast.success(`Imported ${success} new post${success === 1 ? '' : 's'}${wiped ? ` · ${wiped} old post${wiped === 1 ? '' : 's'} wiped` : ''}${dup ? ` · ${dup} already in calendar` : ''}${fail ? ` · ${fail} failed` : ''}`)
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
            Drop a content-plan doc (HTML / Markdown / PDF) and AI will extract the posts, OR paste raw JSON. Safe to re-run — posts already scheduled on the same date with the same title are skipped.
          </DialogDescription>
        </DialogHeader>

        {/* Source toggle: Doc → AI-extract, or paste raw JSON. */}
        <div className="flex gap-1 -mb-1">
          <button
            type="button"
            onClick={() => setSourceMode('doc')}
            className={cn(
              'flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-t border-b-2 transition-colors',
              sourceMode === 'doc'
                ? 'border-primary text-foreground bg-primary/5'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            <FileUp className="h-3.5 w-3.5" /> Upload doc (HTML · MD · PDF)
          </button>
          <button
            type="button"
            onClick={() => setSourceMode('json')}
            className={cn(
              'flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-t border-b-2 transition-colors',
              sourceMode === 'json'
                ? 'border-primary text-foreground bg-primary/5'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            <FileJson className="h-3.5 w-3.5" /> Paste JSON
          </button>
        </div>

        <div className="space-y-3">
          {sourceMode === 'doc' ? (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Drop a plan doc — AI extracts every post and fills the JSON for you. Then switch to "Paste JSON" to review and Import. Posts already on the calendar (same date + title) are silently skipped on import.
              </p>
              <div
                onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('border-primary', 'bg-primary/5') }}
                onDragLeave={(e) => { e.currentTarget.classList.remove('border-primary', 'bg-primary/5') }}
                onDrop={(e) => {
                  e.preventDefault()
                  e.currentTarget.classList.remove('border-primary', 'bg-primary/5')
                  handleDocFile(e.dataTransfer.files?.[0] ?? null)
                }}
                onClick={() => document.getElementById('plan-doc-file')?.click()}
                className="border-2 border-dashed border-border rounded-lg p-5 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors"
              >
                <FileUp className="h-5 w-5 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm font-semibold">Drop a content-plan doc</p>
                <p className="text-xs text-muted-foreground mt-0.5">.html · .md · .pdf · .txt</p>
                <input
                  id="plan-doc-file"
                  type="file"
                  accept=".html,.htm,.md,.markdown,.pdf,.txt,text/html,text/markdown,text/plain,application/pdf"
                  hidden
                  onChange={(e) => { handleDocFile(e.target.files?.[0] ?? null); e.target.value = '' }}
                />
              </div>

              {pendingDoc ? (
                <div className="flex items-center gap-2 border border-border rounded px-3 py-2 bg-muted/30">
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{pendingDoc.name}</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest">{pendingDoc.kind}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPendingDoc(null)}
                    className="h-6 w-6 inline-flex items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-accent"
                    aria-label="Remove"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Or paste plan text
                  </label>
                  <Textarea
                    value={pastedDoc}
                    onChange={(e) => setPastedDoc(e.target.value)}
                    rows={6}
                    placeholder="Paste a content-plan HTML / Markdown / plain text…"
                    className="mt-1.5 font-mono text-xs"
                  />
                </div>
              )}

              {(pendingDoc || pastedDoc.trim().length > 20) ? (
                <Button onClick={extractFromDoc} disabled={extracting} className="w-full gap-1.5">
                  {extracting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  {extracting ? 'AI is reading…' : 'Extract posts'}
                </Button>
              ) : null}
              <p className="text-[10px] text-muted-foreground">
                Extraction may take 30–60s for a 90-post plan. AI will pick the right account slug, type, platforms, and date for each entry.
              </p>
            </div>
          ) : null}

          {sourceMode === 'json' ? <>
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

          {/* Replace-in-range toggle. Off by default: bulk-import behaves
              like before (skip duplicates by date+title, keep everything
              else). On: deletes every existing post for the accounts in
              this payload, within the payload's date span, BEFORE
              inserting. Useful for "wipe last month's plan and replace
              with the new one" flows where the operator wants a clean
              slate instead of cumulative drift. */}
          {preview.items.length > 0 ? (
            <label className={cn(
              'flex items-start gap-3 px-3 py-2.5 rounded-md border cursor-pointer transition-colors',
              replaceInRange
                ? 'border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/30'
                : 'border-border bg-muted/30 hover:bg-muted/50',
            )}>
              <input
                type="checkbox"
                checked={replaceInRange}
                onChange={(e) => setReplaceInRange(e.target.checked)}
                className="h-4 w-4 mt-0.5 shrink-0"
              />
              <div className="min-w-0 flex-1 text-xs">
                <p className={cn('font-semibold', replaceInRange ? 'text-amber-900 dark:text-amber-200' : 'text-foreground')}>
                  Replace existing posts in this date range
                </p>
                <p className={cn('mt-0.5', replaceInRange ? 'text-amber-800 dark:text-amber-300' : 'text-muted-foreground')}>
                  {replaceInRange
                    ? '⚠ Existing posts for the accounts in this plan, scheduled within the plan\'s date span, will be DELETED before import.'
                    : 'Off — duplicate rows (same date + title) are skipped; everything else stays untouched.'}
                </p>
              </div>
            </label>
          ) : null}

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
              <div className={cn('grid gap-2 text-xs tabular-nums', result.wiped ? 'grid-cols-5' : 'grid-cols-4')}>
                <div><div className="text-muted-foreground">Total</div><div className="font-bold">{result.total}</div></div>
                <div className="text-emerald-700 dark:text-emerald-300"><div className="text-muted-foreground">New</div><div className="font-bold">{result.inserted}</div></div>
                {result.wiped ? (
                  <div className="text-amber-700 dark:text-amber-300"><div className="text-muted-foreground">Wiped</div><div className="font-bold">{result.wiped}</div></div>
                ) : null}
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
          </> : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={importing}>Close</Button>
          <Button
            onClick={handleImport}
            disabled={importing || preview.items.length === 0 || !!preview.err || sourceMode === 'doc'}
            className="gap-1.5"
            title={sourceMode === 'doc' ? 'Switch to Paste JSON tab to import the extracted posts.' : undefined}
          >
            {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            {importing ? 'Importing…' : `Import ${preview.items.length || ''} post${preview.items.length === 1 ? '' : 's'}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
