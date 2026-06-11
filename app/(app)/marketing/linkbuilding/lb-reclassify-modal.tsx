'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Loader2, Wand2, ClipboardList, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Verdict {
  id: string
  title: string
  currentType: string
  suggestedType: string
  flagged: boolean
  reason: string
  targetSite: string | null
}

// AI-driven migration UI. Runs once when opened: hits /classify which
// loads every non-task link-building row and asks the LLM to decide
// which ones aren't really link-building work (general TODOs, internal
// research notes, planning items etc.). Returns each row with a
// suggestedType + a one-line reason; the modal shows the AI-flagged
// items pre-ticked, the operator can untick anything they want to keep
// as link-building, then a single Apply call updates the types in bulk.
//
// "Show kept items" toggle reveals the rest of the backlog with the
// AI's "keep" verdicts so the operator can double-check the model
// didn't miss a task disguised as link-building.
export function LbReclassifyModal({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const router = useRouter()
  const [analyzing, setAnalyzing] = useState(false)
  const [items, setItems] = useState<Verdict[] | null>(null)
  const [proposedIds, setProposedIds] = useState<Set<string>>(new Set())
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [showKept, setShowKept] = useState(false)
  const [applying, setApplying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Run the analyze pass on first open. Reset on close so the next open
  // re-runs against the latest DB state.
  useEffect(() => {
    if (!open) {
      setItems(null); setProposedIds(new Set()); setSelected({}); setShowKept(false); setError(null)
      return
    }
    if (items !== null) return
    setAnalyzing(true)
    setError(null)
    fetch('/api/marketing/linkbuilding/classify', { method: 'POST' })
      .then((r) => r.json())
      .then((data) => {
        if (data?.error) { setError(data.error); setItems([]); return }
        const all: Verdict[] = data.items ?? []
        const flagged: Verdict[] = data.proposed ?? []
        setItems(all)
        const ids = new Set(flagged.map((v) => v.id))
        setProposedIds(ids)
        // Pre-tick every AI-flagged row so the operator just has to untick
        // the ones they disagree with.
        setSelected(Object.fromEntries(flagged.map((v) => [v.id, true])))
      })
      .catch((e) => setError(String(e?.message ?? e)))
      .finally(() => setAnalyzing(false))
  }, [open, items])

  function toggle(id: string) {
    setSelected({ ...selected, [id]: !selected[id] })
  }
  function setAll(value: boolean) {
    if (!items) return
    const next: Record<string, boolean> = { ...selected }
    for (const v of items) {
      if (v.flagged) next[v.id] = value
    }
    setSelected(next)
  }

  async function apply() {
    const ids = Object.keys(selected).filter((id) => selected[id])
    if (ids.length === 0) { toast.error('Nothing selected'); return }
    setApplying(true)
    try {
      const res = await fetch('/api/marketing/linkbuilding/bulk-set-type', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, newType: 'task' }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(data?.error ?? 'Move failed'); return }
      toast.success(`Moved ${data.updated} item${data.updated === 1 ? '' : 's'} to Tasks Andrew`)
      router.refresh()
      onOpenChange(false)
    } finally { setApplying(false) }
  }

  const flaggedItems = items?.filter((v) => v.flagged) ?? []
  const keptItems = items?.filter((v) => !v.flagged) ?? []
  const selectedCount = Object.values(selected).filter(Boolean).length

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="h-4 w-4" /> Reclassify items
          </DialogTitle>
          <DialogDescription>
            AI scans every non-task row in Link Building and flags the ones that look like general tasks
            (anything not aimed at earning a backlink). Tick the ones you want to move; they'll show up
            on Tasks Andrew instead.
          </DialogDescription>
        </DialogHeader>

        {analyzing ? (
          <div className="flex-1 flex items-center justify-center py-16">
            <div className="text-center text-sm text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin mx-auto mb-3" />
              AI is reading the backlog…
            </div>
          </div>
        ) : error ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 py-4 px-4 text-sm text-destructive">
            {error}
          </div>
        ) : items && items.length === 0 ? (
          <div className="flex-1 flex items-center justify-center py-16">
            <div className="text-center">
              <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto mb-3" />
              <h3 className="font-semibold">Nothing to scan</h3>
              <p className="text-sm text-muted-foreground mt-2 max-w-md">
                Link Building has no items right now, so there's nothing to reclassify.
              </p>
            </div>
          </div>
        ) : flaggedItems.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-12 px-6 text-center">
            <CheckCircle2 className="h-10 w-10 text-emerald-500 mb-3" />
            <h3 className="font-semibold">Everything looks like real link-building</h3>
            <p className="text-sm text-muted-foreground mt-2 max-w-md">
              AI scanned {items?.length ?? 0} item{(items?.length ?? 0) === 1 ? '' : 's'} and didn't find any
              that look like general tasks. Click "Show all" below if you want to spot-check the verdicts.
            </p>
            <button
              type="button"
              onClick={() => setShowKept((v) => !v)}
              className="mt-4 text-xs text-primary hover:underline"
            >
              {showKept ? 'Hide all-item review' : 'Show all-item review'}
            </button>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto -mx-6 px-6 space-y-3">
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <span className="text-muted-foreground">
                AI flagged {flaggedItems.length} of {items?.length ?? 0} item{(items?.length ?? 0) === 1 ? '' : 's'}.
                {selectedCount > 0 ? ` ${selectedCount} selected to move.` : ''}
              </span>
              <button type="button" onClick={() => setAll(true)} className="text-primary hover:underline">Select all flagged</button>
              <span className="text-muted-foreground/50">·</span>
              <button type="button" onClick={() => setAll(false)} className="text-primary hover:underline">Clear</button>
            </div>

            <div className="border border-border rounded-lg divide-y divide-border">
              {flaggedItems.map((v) => (
                <ItemRow
                  key={v.id}
                  v={v}
                  checked={Boolean(selected[v.id])}
                  onToggle={() => toggle(v.id)}
                  tone="flagged"
                />
              ))}
            </div>

            {keptItems.length > 0 ? (
              <div>
                <button
                  type="button"
                  onClick={() => setShowKept((s) => !s)}
                  className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5"
                >
                  {showKept ? '−' : '+'} {showKept ? 'Hide' : 'Show'} {keptItems.length} item{keptItems.length === 1 ? '' : 's'} AI kept as link-building
                </button>
                {showKept ? (
                  <div className="mt-2 border border-border rounded-lg divide-y divide-border">
                    {keptItems.map((v) => (
                      <ItemRow
                        key={v.id}
                        v={v}
                        checked={Boolean(selected[v.id])}
                        onToggle={() => toggle(v.id)}
                        tone="kept"
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={analyzing || applying}>
            Cancel
          </Button>
          <Button
            onClick={apply}
            disabled={analyzing || applying || selectedCount === 0}
            className="gap-1.5"
          >
            {applying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ClipboardList className="h-3.5 w-3.5" />}
            {applying ? 'Moving…' : `Move ${selectedCount} to Tasks Andrew`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ItemRow({
  v,
  checked,
  onToggle,
  tone,
}: {
  v: Verdict
  checked: boolean
  onToggle: () => void
  tone: 'flagged' | 'kept'
}) {
  return (
    <label
      className={cn(
        'flex items-start gap-3 px-3 py-2.5 cursor-pointer hover:bg-accent/30 transition-colors',
        !checked && 'opacity-60',
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        className="h-4 w-4 mt-0.5 shrink-0"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium leading-tight">{v.title}</p>
          <span className={cn(
            'inline-block text-[10px] uppercase tracking-widest font-semibold px-1.5 py-0.5 rounded',
            tone === 'flagged'
              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
              : 'bg-muted text-muted-foreground',
          )}>
            {v.currentType} → task
          </span>
        </div>
        {v.targetSite ? (
          <p className="text-[11px] text-muted-foreground mt-0.5 truncate">target: {v.targetSite}</p>
        ) : null}
        {v.reason ? (
          <p className="text-xs text-muted-foreground mt-1 italic line-clamp-2">{v.reason}</p>
        ) : null}
      </div>
    </label>
  )
}
