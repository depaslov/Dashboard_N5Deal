'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { FileText, Plus, Trash2, Edit3, Code2, Eye, X, ExternalLink } from 'lucide-react'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

interface StrategyNote {
  id: string
  title: string
  html: string
  sortOrder: number
  createdAt: string
  updatedAt: string
}

// Renders user-authored HTML inside a sandboxed iframe so any inline
// <style>, <script>, or full-document layout from a pasted doc can't leak
// into / break the dashboard's own styling. srcDoc is a string-set sandbox
// page, sandbox attribute drops scripts + same-origin so even if someone
// pastes hostile HTML the worst it does is render visually.
function SandboxedHtml({ html, className }: { html: string; className?: string }) {
  return (
    <iframe
      title="Note preview"
      srcDoc={html}
      sandbox=""
      className={cn('w-full border-0 bg-white dark:bg-zinc-50', className)}
      // Auto-size to the content height up to a cap. Done via onLoad so it
      // adapts to whatever the pasted HTML actually renders to.
      onLoad={(e) => {
        try {
          const el = e.currentTarget
          const doc = el.contentDocument
          if (!doc) return
          const h = Math.min(doc.body.scrollHeight, 4000)
          el.style.height = `${h + 8}px`
        } catch { /* cross-origin or sandbox limits */ }
      }}
    />
  )
}

type Mode =
  | { kind: 'create' }
  | { kind: 'edit'; note: StrategyNote }
  | null

export function StrategyNotes() {
  const router = useRouter()
  const [notes, setNotes] = useState<StrategyNote[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<Mode>(null)
  const [openNote, setOpenNote] = useState<StrategyNote | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true); setError(null)
    fetch('/api/marketing/strategy/notes')
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return
        if (data?.error) { setError(data.error); setNotes([]); return }
        setNotes(data.notes ?? [])
      })
      .catch((e) => { if (!cancelled) setError(String(e?.message ?? e)) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  async function refresh() {
    const data = await fetch('/api/marketing/strategy/notes').then((r) => r.json()).catch(() => null)
    if (data?.notes) setNotes(data.notes)
  }

  async function deleteNote(id: string) {
    if (!confirm('Delete this note? This cannot be undone.')) return
    const res = await fetch(`/api/marketing/strategy/notes/${id}`, { method: 'DELETE' })
    if (!res.ok) { toast.error('Could not delete'); return }
    toast.success('Note deleted')
    setOpenNote(null)
    await refresh()
    router.refresh()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <h2 className="font-display text-lg font-semibold tracking-tight">Notes</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Free-form HTML notes attached to the strategy — meeting recaps, agency briefs, reference docs. Edit any time.
          </p>
        </div>
        <Button onClick={() => setMode({ kind: 'create' })}>
          <Plus className="h-4 w-4 mr-1.5" /> Add note
        </Button>
      </div>

      {loading ? (
        <div className="rounded-lg border border-border bg-card py-10 text-center text-sm text-muted-foreground">
          Loading notes…
        </div>
      ) : error ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 py-4 px-4 text-sm text-destructive">
          Could not load notes: {error}
        </div>
      ) : !notes || notes.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card py-14 px-6 text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 mb-3">
            <FileText className="h-6 w-6 text-primary" />
          </div>
          <h3 className="font-semibold">No notes yet</h3>
          <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
            Paste a report, meeting notes, agency hand-off, or any other HTML doc — it gets stored on this project and you can edit it whenever.
          </p>
          <Button className="mt-4" onClick={() => setMode({ kind: 'create' })}>
            <Plus className="h-4 w-4 mr-1.5" /> Add your first note
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {notes.map((n) => (
            <NoteCard
              key={n.id}
              note={n}
              onOpen={() => setOpenNote(n)}
              onEdit={() => setMode({ kind: 'edit', note: n })}
              onDelete={() => deleteNote(n.id)}
            />
          ))}
        </div>
      )}

      <NoteFormModal mode={mode} onClose={() => setMode(null)} onSaved={refresh} />
      <NoteViewerModal
        note={openNote}
        onClose={() => setOpenNote(null)}
        onEdit={() => { if (openNote) { setMode({ kind: 'edit', note: openNote }); setOpenNote(null) } }}
        onDelete={() => { if (openNote) deleteNote(openNote.id) }}
      />
    </div>
  )
}

function NoteCard({
  note,
  onOpen,
  onEdit,
  onDelete,
}: {
  note: StrategyNote
  onOpen: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  // Lightweight preview text — strip tags + collapse whitespace so we can
  // show the first ~150 chars under the title. Cards don't render the
  // full HTML — that lives inside the viewer modal.
  const preview = note.html
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180)

  return (
    <div className="group bg-card border border-border rounded-lg p-4 hover:border-primary/40 transition-colors flex flex-col gap-2">
      <div className="flex items-start gap-2">
        <FileText className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
        <button type="button" onClick={onOpen} className="text-left flex-1 min-w-0">
          <p className="font-medium text-sm leading-snug line-clamp-2">{note.title}</p>
        </button>
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button variant="ghost" size="icon-sm" onClick={onEdit} aria-label="Edit" title="Edit">
            <Edit3 className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={onDelete} aria-label="Delete" title="Delete" className="text-muted-foreground hover:text-destructive">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      {preview ? (
        <button type="button" onClick={onOpen} className="text-left">
          <p className="text-xs text-muted-foreground line-clamp-3">{preview}</p>
        </button>
      ) : null}
      <div className="flex items-center gap-3 mt-auto pt-1 text-[10px] text-muted-foreground">
        <span>Updated {format(new Date(note.updatedAt), 'd LLL yyyy')}</span>
        <button type="button" onClick={onOpen} className="ml-auto inline-flex items-center gap-1 hover:text-foreground">
          Open <ExternalLink className="h-3 w-3" />
        </button>
      </div>
    </div>
  )
}

function NoteViewerModal({
  note,
  onClose,
  onEdit,
  onDelete,
}: {
  note: StrategyNote | null
  onClose: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <Dialog open={note !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col">
        <DialogHeader className="flex-row items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <DialogTitle className="truncate">{note?.title}</DialogTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Updated {note ? format(new Date(note.updatedAt), 'd LLL yyyy, HH:mm') : ''}
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Button variant="outline" size="sm" onClick={onEdit} className="gap-1.5">
              <Edit3 className="h-3.5 w-3.5" /> Edit
            </Button>
            <Button variant="outline" size="sm" onClick={onDelete} className="gap-1.5 text-destructive hover:text-destructive">
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </Button>
          </div>
        </DialogHeader>
        <div className="overflow-y-auto flex-1 -mx-6 px-6 pt-2">
          {note ? <SandboxedHtml html={note.html} className="min-h-[200px]" /> : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function NoteFormModal({
  mode,
  onClose,
  onSaved,
}: {
  mode: Mode
  onClose: () => void
  onSaved: () => void
}) {
  const isEdit = mode?.kind === 'edit'
  const open = mode !== null

  const [title, setTitle] = useState('')
  const [html, setHtml] = useState('')
  const [view, setView] = useState<'code' | 'preview'>('code')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!mode) return
    if (mode.kind === 'edit') {
      setTitle(mode.note.title)
      setHtml(mode.note.html)
    } else {
      setTitle('')
      setHtml('')
    }
    setView('code')
  }, [mode])

  async function save() {
    if (!title.trim()) { toast.error('Title is required'); return }
    if (!html.trim()) { toast.error('Note body is empty'); return }
    setSaving(true)
    try {
      const url = isEdit ? `/api/marketing/strategy/notes/${mode!.note.id}` : '/api/marketing/strategy/notes'
      const method = isEdit ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), html }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(data?.error ?? 'Save failed'); return }
      toast.success(isEdit ? 'Note updated' : 'Note added')
      onSaved()
      onClose()
    } finally { setSaving(false) }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit note' : 'New note'}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 flex flex-col gap-3 min-h-0">
          <div>
            <Label htmlFor="note-title">Title</Label>
            <Input
              id="note-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Q3 agency brief, Vienna offsite recap, partner deck v2"
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="note-html">HTML body</Label>
            <div className="inline-flex p-0.5 bg-muted rounded border border-border">
              <button
                type="button"
                onClick={() => setView('code')}
                className={cn(
                  'inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-sm transition-colors',
                  view === 'code' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Code2 className="h-3.5 w-3.5" /> Code
              </button>
              <button
                type="button"
                onClick={() => setView('preview')}
                className={cn(
                  'inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-sm transition-colors',
                  view === 'preview' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Eye className="h-3.5 w-3.5" /> Preview
              </button>
            </div>
          </div>

          <div className="flex-1 min-h-[300px] overflow-hidden border border-border rounded-lg">
            {view === 'code' ? (
              <Textarea
                id="note-html"
                value={html}
                onChange={(e) => setHtml(e.target.value)}
                placeholder={'<div>\n  <h1>Title</h1>\n  <p>Paste any HTML — full docs work too. Inline <style> tags are isolated inside a sandboxed iframe.</p>\n</div>'}
                className="w-full h-full font-mono text-xs border-0 rounded-none resize-none min-h-[300px]"
              />
            ) : (
              <div className="w-full h-full overflow-y-auto">
                {html.trim() ? (
                  <SandboxedHtml html={html} className="min-h-[300px]" />
                ) : (
                  <div className="h-full flex items-center justify-center text-sm text-muted-foreground p-8 text-center">
                    Switch to Code, paste some HTML, then come back here to preview.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            <X className="h-4 w-4" /> Cancel
          </Button>
          <Button onClick={save} loading={saving}>
            {isEdit ? 'Save changes' : 'Add note'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
