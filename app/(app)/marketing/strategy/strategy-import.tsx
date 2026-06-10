'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Upload, FileUp, FileText, Loader2, Sparkles, X, CheckCircle2 } from 'lucide-react'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { type StrategyAdditions } from '@/lib/marketing/strategy-merge'

type Kind = 'html' | 'markdown' | 'text' | 'pdf'
interface PendingDoc { name: string; kind: Kind; content: string /* raw text or PDF data URL */ }

// Two-step modal: (1) pick / paste doc + Analyze; (2) review proposed
// additions with checkboxes + Apply. The Strategy editor's existing
// JSON columns (budget / goals / channelDirectives / currentState /
// authorityLayer) get topped up with whatever the operator selects —
// nothing existing is ever overwritten (server-side filter pass guards
// that even if the user ticked something).
export function StrategyImporter() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const [pendingDoc, setPendingDoc] = useState<PendingDoc | null>(null)
  const [pastedText, setPastedText] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [additions, setAdditions] = useState<StrategyAdditions | null>(null)
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [applying, setApplying] = useState(false)

  function reset() {
    setPendingDoc(null); setPastedText(''); setAdditions(null); setSelected({}); setAnalyzing(false); setApplying(false)
  }

  function close() { reset(); setOpen(false) }

  async function handleFile(file: File | null) {
    if (!file) return
    const name = file.name.toLowerCase()
    const isPdf = name.endsWith('.pdf') || file.type === 'application/pdf'
    const isHtml = name.endsWith('.html') || name.endsWith('.htm') || file.type === 'text/html'
    const isMd = name.endsWith('.md') || name.endsWith('.markdown') || file.type === 'text/markdown'
    const isTxt = name.endsWith('.txt') || file.type === 'text/plain'
    if (!isPdf && !isHtml && !isMd && !isTxt) {
      toast.error('Supported: .html, .md, .pdf, .txt')
      return
    }
    try {
      if (isPdf) {
        const dataUrl = await fileToDataUrl(file)
        setPendingDoc({ name: file.name, kind: 'pdf', content: dataUrl })
      } else {
        const text = await file.text()
        const kind: Kind = isHtml ? 'html' : isMd ? 'markdown' : 'text'
        setPendingDoc({ name: file.name, kind, content: text })
      }
      setPastedText('')
    } catch { toast.error(`Could not read ${file.name}`) }
  }

  async function analyze() {
    const fromPaste = !pendingDoc && pastedText.trim().length > 20
    if (!pendingDoc && !fromPaste) { toast.error('Pick a file or paste a doc first'); return }
    setAnalyzing(true)
    try {
      const body: Record<string, unknown> = {}
      if (pendingDoc?.kind === 'pdf') {
        body.kind = 'pdf'; body.dataUrl = pendingDoc.content
      } else if (pendingDoc) {
        body.kind = pendingDoc.kind; body.content = pendingDoc.content
      } else {
        const trimmed = pastedText.trim()
        body.kind = trimmed.startsWith('<') ? 'html' : /^#{1,6}\s|\n#{1,6}\s/.test(trimmed) ? 'markdown' : 'text'
        body.content = pastedText
      }
      const res = await fetch('/api/marketing/strategy/import/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(data?.error ?? 'Analyze failed'); return }
      const proposed = (data.additions ?? {}) as StrategyAdditions
      setAdditions(proposed)
      // Pre-tick everything by default — operator unticks what they don't
      // want. Less friction than ticking each item individually.
      setSelected(allKeys(proposed).reduce((acc, k) => { acc[k] = true; return acc }, {} as Record<string, boolean>))
      if (data.newCount === 0) {
        toast.message('No new items found in the document.')
      }
    } finally { setAnalyzing(false) }
  }

  async function apply() {
    if (!additions) return
    const curated = pickSelected(additions, selected)
    setApplying(true)
    try {
      const res = await fetch('/api/marketing/strategy/import/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ additions: curated }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(data?.error ?? 'Apply failed'); return }
      toast.success(`Applied ${data.applied ?? 0} new item${(data.applied ?? 0) === 1 ? '' : 's'} to strategy`)
      router.refresh()
      close()
    } finally { setApplying(false) }
  }

  // ── render ──
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)} className="gap-1.5">
        <Upload className="h-3.5 w-3.5" /> Import strategy
      </Button>

      <Dialog open={open} onOpenChange={(o) => { if (!o) close() }}>
        <DialogContent className="max-w-3xl max-h-[92vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Import strategy</DialogTitle>
          </DialogHeader>

          {/* Step 1: pick / paste */}
          {!additions ? (
            <div className="space-y-3 flex-1 overflow-y-auto">
              <p className="text-xs text-muted-foreground">
                Drop a strategy doc (HTML / Markdown / PDF / text) — AI extracts budgets, KPIs, channel directives,
                current state, and authority-layer pieces. The next step shows you a checklist of items the document
                has that your saved strategy doesn't, so you can tick what to add. Nothing existing is ever
                overwritten.
              </p>

              <div
                onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('border-primary', 'bg-primary/5') }}
                onDragLeave={(e) => { e.currentTarget.classList.remove('border-primary', 'bg-primary/5') }}
                onDrop={(e) => {
                  e.preventDefault()
                  e.currentTarget.classList.remove('border-primary', 'bg-primary/5')
                  handleFile(e.dataTransfer.files?.[0] ?? null)
                }}
                onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors"
              >
                <FileUp className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm font-semibold">Drop a strategy doc</p>
                <p className="text-xs text-muted-foreground mt-1">.html · .md · .pdf · .txt</p>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".html,.htm,.md,.markdown,.pdf,.txt,text/html,text/markdown,text/plain,application/pdf"
                  hidden
                  onChange={(e) => { handleFile(e.target.files?.[0] ?? null); e.target.value = '' }}
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
                  <Label htmlFor="strat-paste" className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Or paste strategy text
                  </Label>
                  <Textarea
                    id="strat-paste"
                    value={pastedText}
                    onChange={(e) => setPastedText(e.target.value)}
                    rows={6}
                    placeholder="Paste HTML, Markdown, or plain text strategy here…"
                    className="mt-1.5 text-xs font-mono"
                  />
                </div>
              )}
            </div>
          ) : (
            // Step 2: review
            <ReviewTree
              additions={additions}
              selected={selected}
              setSelected={setSelected}
            />
          )}

          <DialogFooter>
            <Button variant="outline" onClick={close} disabled={analyzing || applying}>
              Cancel
            </Button>
            {!additions ? (
              <Button onClick={analyze} disabled={analyzing} className="gap-1.5">
                {analyzing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                {analyzing ? 'Analyzing…' : 'Analyze'}
              </Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => { setAdditions(null); setSelected({}) }} disabled={applying}>
                  Pick another doc
                </Button>
                <Button onClick={apply} loading={applying} className="gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Apply {Object.values(selected).filter(Boolean).length} selected
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ── ReviewTree: render the additions as a tree of checkbox rows ─────────

function ReviewTree({
  additions,
  selected,
  setSelected,
}: {
  additions: StrategyAdditions
  selected: Record<string, boolean>
  setSelected: (next: Record<string, boolean>) => void
}) {
  function toggle(key: string) {
    setSelected({ ...selected, [key]: !selected[key] })
  }
  function setSection(prefix: string, value: boolean) {
    const next = { ...selected }
    for (const k of Object.keys(selected)) if (k.startsWith(prefix)) next[k] = value
    setSelected(next)
  }

  const sections: { title: string; prefix: string; rows: { key: string; label: string; sub?: string }[] }[] = []

  if (additions.budget) {
    const rows: { key: string; label: string; sub?: string }[] = []
    for (const [month, channels] of Object.entries(additions.budget)) {
      for (const [channel, item] of Object.entries(channels)) {
        rows.push({
          key: `budget.${month}.${channel}`,
          label: `${prettyMonth(month)} · ${prettyChannel(channel)}`,
          sub: `$${item.min}–$${item.max} · ${item.purpose}`,
        })
      }
    }
    if (rows.length) sections.push({ title: 'Budget', prefix: 'budget.', rows })
  }

  if (additions.goals) {
    const rows: { key: string; label: string; sub?: string }[] = []
    for (const [channel, metrics] of Object.entries(additions.goals)) {
      for (const [metric, item] of Object.entries(metrics)) {
        rows.push({
          key: `goals.${channel}.${metric}`,
          label: `${prettyChannel(channel)} · ${item.label ?? metric}`,
          sub: `baseline ${item.baseline} → target ${item.target}${item.unit ? ' ' + item.unit : ''}`,
        })
      }
    }
    if (rows.length) sections.push({ title: 'Goals', prefix: 'goals.', rows })
  }

  if (additions.channelDirectives) {
    const rows = Object.entries(additions.channelDirectives).map(([channel, d]) => ({
      key: `channelDirectives.${channel}`,
      label: `${prettyChannel(channel)} · ${d.title}`,
      sub: d.body.slice(0, 200) + (d.body.length > 200 ? '…' : ''),
    }))
    if (rows.length) sections.push({ title: 'Channel directives', prefix: 'channelDirectives.', rows })
  }

  if (additions.currentState) {
    const rows: { key: string; label: string; sub?: string }[] = []
    if (additions.currentState.asOf) rows.push({ key: 'currentState.asOf', label: 'As of', sub: additions.currentState.asOf })
    if (additions.currentState.gap) rows.push({ key: 'currentState.gap', label: 'System gap', sub: additions.currentState.gap.slice(0, 200) })
    if (additions.currentState.channels) {
      for (const [channel, c] of Object.entries(additions.currentState.channels)) {
        rows.push({
          key: `currentState.channels.${channel}`,
          label: `Channel · ${c.label}`,
          sub: c.diagnosis?.slice(0, 200),
        })
      }
    }
    if (rows.length) sections.push({ title: 'Current state', prefix: 'currentState.', rows })
  }

  if (additions.authorityLayer) {
    const al = additions.authorityLayer
    const rows: { key: string; label: string; sub?: string }[] = []
    if (al.coreShift) rows.push({ key: 'authorityLayer.coreShift', label: 'Core shift', sub: al.coreShift.slice(0, 200) })
    if (al.positioning) rows.push({ key: 'authorityLayer.positioning', label: 'Positioning', sub: al.positioning.slice(0, 200) })
    if (al.california) rows.push({ key: 'authorityLayer.california', label: 'California', sub: `${al.california.name} · ${al.california.kind}` })
    if (al.reportSystem) rows.push({ key: 'authorityLayer.reportSystem', label: 'Report system', sub: al.reportSystem.intro?.slice(0, 200) })
    if (al.q3Events) {
      al.q3Events.forEach((e, i) => {
        rows.push({
          key: `authorityLayer.q3Events.${i}`,
          label: `Q3 event · ${e.name}`,
          sub: `${e.month} · ${e.role}`,
        })
      })
    }
    if (al.measurement) {
      al.measurement.forEach((m, i) => {
        rows.push({
          key: `authorityLayer.measurement.${i}`,
          label: 'Measurement',
          sub: m,
        })
      })
    }
    if (rows.length) sections.push({ title: 'Authority layer', prefix: 'authorityLayer.', rows })
  }

  if (sections.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-center px-8 py-12">
        <div>
          <CheckCircle2 className="h-10 w-10 mx-auto text-emerald-500 mb-3" />
          <h3 className="font-semibold">Nothing new to add</h3>
          <p className="text-sm text-muted-foreground mt-2 max-w-md">
            The AI couldn't find any pieces in this document that aren't already in your saved strategy.
          </p>
        </div>
      </div>
    )
  }

  const totalChecked = Object.values(selected).filter(Boolean).length

  return (
    <div className="flex-1 overflow-y-auto -mx-6 px-6 space-y-5">
      <p className="text-xs text-muted-foreground -mt-1">
        {totalChecked} of {Object.keys(selected).length} items selected. Anything ticked gets added to your strategy.
        Existing data is never overwritten.
      </p>
      {sections.map((sec) => {
        const sectionRowKeys = sec.rows.map((r) => r.key)
        const allOn = sectionRowKeys.every((k) => selected[k])
        const someOn = sectionRowKeys.some((k) => selected[k])
        return (
          <div key={sec.prefix}>
            <div className="flex items-center gap-2 mb-2">
              <input
                type="checkbox"
                checked={allOn}
                ref={(el) => { if (el) el.indeterminate = !allOn && someOn }}
                onChange={() => setSection(sec.prefix, !allOn)}
                className="h-3.5 w-3.5"
              />
              <h4 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                {sec.title} <span className="text-muted-foreground/60 font-normal">({sec.rows.length})</span>
              </h4>
            </div>
            <div className="border border-border rounded-lg divide-y divide-border">
              {sec.rows.map((r) => (
                <label
                  key={r.key}
                  className={cn(
                    'flex items-start gap-3 px-3 py-2 cursor-pointer hover:bg-accent/30 transition-colors',
                    !selected[r.key] && 'opacity-50',
                  )}
                >
                  <input
                    type="checkbox"
                    checked={Boolean(selected[r.key])}
                    onChange={() => toggle(r.key)}
                    className="h-3.5 w-3.5 mt-0.5 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium leading-tight">{r.label}</p>
                    {r.sub ? <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{r.sub}</p> : null}
                  </div>
                </label>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Helpers ─────────────────────────────────────────────────────────────

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(new Error('FileReader failed'))
    r.readAsDataURL(file)
  })
}

function prettyMonth(m: string): string {
  return { april: 'April', may: 'May', june: 'June', q3: 'Q3', q4: 'Q4' }[m] ?? m
}
function prettyChannel(c: string): string {
  return {
    instagram: 'Instagram', linkedin: 'LinkedIn', youtube: 'YouTube', website: 'Website',
    linkBuilding: 'Link Building', pr: 'PR', telegram: 'Telegram', events: 'Online Events',
    california: 'California', free: 'Free Sources',
  }[c] ?? c
}

// Build the flat list of keys in the same path-language the checkboxes use
// ('budget.april.instagram', 'authorityLayer.q3Events.0', etc.).
function allKeys(a: StrategyAdditions): string[] {
  const keys: string[] = []
  if (a.budget) {
    for (const m of Object.keys(a.budget)) {
      for (const c of Object.keys(a.budget[m])) keys.push(`budget.${m}.${c}`)
    }
  }
  if (a.goals) {
    for (const c of Object.keys(a.goals)) {
      for (const m of Object.keys(a.goals[c])) keys.push(`goals.${c}.${m}`)
    }
  }
  if (a.channelDirectives) {
    for (const c of Object.keys(a.channelDirectives)) keys.push(`channelDirectives.${c}`)
  }
  if (a.currentState) {
    if (a.currentState.asOf) keys.push('currentState.asOf')
    if (a.currentState.gap) keys.push('currentState.gap')
    if (a.currentState.channels) for (const c of Object.keys(a.currentState.channels)) keys.push(`currentState.channels.${c}`)
  }
  if (a.authorityLayer) {
    const al = a.authorityLayer
    if (al.coreShift) keys.push('authorityLayer.coreShift')
    if (al.positioning) keys.push('authorityLayer.positioning')
    if (al.california) keys.push('authorityLayer.california')
    if (al.reportSystem) keys.push('authorityLayer.reportSystem')
    al.q3Events?.forEach((_, i) => keys.push(`authorityLayer.q3Events.${i}`))
    al.measurement?.forEach((_, i) => keys.push(`authorityLayer.measurement.${i}`))
  }
  return keys
}

// Walk additions and keep only the parts whose path is selected. Mirrors
// allKeys()'s path syntax exactly.
function pickSelected(a: StrategyAdditions, selected: Record<string, boolean>): StrategyAdditions {
  const out: StrategyAdditions = {}
  if (a.budget) {
    for (const m of Object.keys(a.budget)) {
      for (const c of Object.keys(a.budget[m])) {
        if (!selected[`budget.${m}.${c}`]) continue
        out.budget ??= {}; out.budget[m] ??= {}; out.budget[m][c] = a.budget[m][c]
      }
    }
  }
  if (a.goals) {
    for (const c of Object.keys(a.goals)) {
      for (const m of Object.keys(a.goals[c])) {
        if (!selected[`goals.${c}.${m}`]) continue
        out.goals ??= {}; out.goals[c] ??= {}; out.goals[c][m] = a.goals[c][m]
      }
    }
  }
  if (a.channelDirectives) {
    for (const c of Object.keys(a.channelDirectives)) {
      if (!selected[`channelDirectives.${c}`]) continue
      out.channelDirectives ??= {}; out.channelDirectives[c] = a.channelDirectives[c]
    }
  }
  if (a.currentState) {
    const cs: NonNullable<StrategyAdditions['currentState']> = {}
    if (a.currentState.asOf && selected['currentState.asOf']) cs.asOf = a.currentState.asOf
    if (a.currentState.gap && selected['currentState.gap']) cs.gap = a.currentState.gap
    if (a.currentState.channels) {
      for (const c of Object.keys(a.currentState.channels)) {
        if (!selected[`currentState.channels.${c}`]) continue
        cs.channels ??= {}; cs.channels[c] = a.currentState.channels[c]
      }
    }
    if (cs.asOf || cs.gap || (cs.channels && Object.keys(cs.channels).length > 0)) out.currentState = cs
  }
  if (a.authorityLayer) {
    const al = a.authorityLayer
    const outAl: NonNullable<StrategyAdditions['authorityLayer']> = {}
    if (al.coreShift && selected['authorityLayer.coreShift']) outAl.coreShift = al.coreShift
    if (al.positioning && selected['authorityLayer.positioning']) outAl.positioning = al.positioning
    if (al.california && selected['authorityLayer.california']) outAl.california = al.california
    if (al.reportSystem && selected['authorityLayer.reportSystem']) outAl.reportSystem = al.reportSystem
    if (al.q3Events) {
      const fresh = al.q3Events.filter((_, i) => selected[`authorityLayer.q3Events.${i}`])
      if (fresh.length > 0) outAl.q3Events = fresh
    }
    if (al.measurement) {
      const fresh = al.measurement.filter((_, i) => selected[`authorityLayer.measurement.${i}`])
      if (fresh.length > 0) outAl.measurement = fresh
    }
    if (Object.keys(outAl).length > 0) out.authorityLayer = outAl
  }
  return out
}
