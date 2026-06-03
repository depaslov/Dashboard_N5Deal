'use client'

import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react'
import { renderMarkdown } from '@/lib/markdown'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  MessageSquarePlus, Check, X, Trash2, Pencil, MessageSquare, CheckCircle2,
  Circle, Loader2, ChevronDown, ChevronUp,
} from 'lucide-react'
import { toast } from 'sonner'

export interface Annotation {
  id: string
  selectedText: string
  note: string
  contextBefore: string | null
  contextAfter: string | null
  resolved: boolean
  createdAt: string
  updatedAt: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared state via React Context, so the rendered body (inside the editor card)
// and the annotation list (in a sibling column) can share annotations + actions
// without prop-drilling through the server page layout.
// ─────────────────────────────────────────────────────────────────────────────
interface CtxValue {
  contentId: string
  annotations: Annotation[]
  focusedId: string | null
  setFocusedId: (id: string | null) => void
  create: (input: { selectedText: string; note: string; contextBefore: string | null; contextAfter: string | null }) => Promise<void>
  update: (id: string, patch: { note?: string; resolved?: boolean }) => Promise<void>
  remove: (id: string) => Promise<void>
  /** Counter incremented after every annotation mutation. Body re-renders to refresh highlights. */
  version: number
}

const AnnotationsCtx = createContext<CtxValue | null>(null)

function useAnnotations() {
  const v = useContext(AnnotationsCtx)
  if (!v) throw new Error('useAnnotations must be used inside <AnnotationsProvider>')
  return v
}

export function AnnotationsProvider({
  contentId, initialAnnotations, children,
}: {
  contentId: string
  initialAnnotations: Annotation[]
  children: React.ReactNode
}) {
  const [annotations, setAnnotations] = useState<Annotation[]>(initialAnnotations)
  const [focusedId, setFocusedId] = useState<string | null>(null)
  const [version, setVersion] = useState(0)

  const create = useCallback(async (input: { selectedText: string; note: string; contextBefore: string | null; contextAfter: string | null }) => {
    const res = await fetch(`/api/content/${contentId}/annotations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
    const data = await res.json()
    if (!res.ok) { toast.error(data?.error ?? 'Could not save'); return }
    setAnnotations((prev) => [...prev, data.annotation])
    setVersion((v) => v + 1)
    toast.success('Note added')
  }, [contentId])

  const update = useCallback(async (id: string, patch: { note?: string; resolved?: boolean }) => {
    const res = await fetch(`/api/annotations/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    const data = await res.json()
    if (!res.ok) { toast.error(data?.error ?? 'Could not update'); return }
    setAnnotations((prev) => prev.map((a) => (a.id === id ? data.annotation : a)))
    setVersion((v) => v + 1)
  }, [])

  const remove = useCallback(async (id: string) => {
    if (!confirm('Delete this note?')) return
    const res = await fetch(`/api/annotations/${id}`, { method: 'DELETE' })
    if (!res.ok) { toast.error('Could not delete'); return }
    setAnnotations((prev) => prev.filter((a) => a.id !== id))
    setVersion((v) => v + 1)
    toast.success('Deleted')
  }, [])

  const value = useMemo<CtxValue>(() => ({
    contentId, annotations, focusedId, setFocusedId, create, update, remove, version,
  }), [contentId, annotations, focusedId, create, update, remove, version])

  return <AnnotationsCtx.Provider value={value}>{children}</AnnotationsCtx.Provider>
}

// ─────────────────────────────────────────────────────────────────────────────
// Body: renders the markdown + applies inline <mark> highlights + selection popover.
// Sits inside the editor card (the main left column).
// ─────────────────────────────────────────────────────────────────────────────
export function AnnotationsBody({ markdown }: { markdown: string }) {
  const { annotations, focusedId, setFocusedId, create, version } = useAnnotations()
  const containerRef = useRef<HTMLDivElement>(null)
  const [draft, setDraft] = useState<{
    rect: DOMRect; text: string; contextBefore: string; contextAfter: string; note: string
  } | null>(null)
  const [saving, setSaving] = useState(false)

  // Re-render markdown + apply highlights whenever the body or annotations change.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    el.innerHTML = renderMarkdown(markdown)
    for (const ann of annotations) applyHighlight(el, ann, ann.id === focusedId)
  }, [markdown, annotations, focusedId, version])

  // Click on a highlight → focus its card in the right column.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      const mark = target.closest('[data-ann-id]') as HTMLElement | null
      if (!mark) return
      const id = mark.getAttribute('data-ann-id')
      if (!id) return
      setFocusedId(id)
      requestAnimationFrame(() => {
        document.querySelector(`[data-ann-card-id="${id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      })
    }
    el.addEventListener('click', onClick)
    return () => el.removeEventListener('click', onClick)
  }, [setFocusedId])

  // Capture selection inside the body — open the floating "Add note" popover.
  useEffect(() => {
    const onMouseUp = () => {
      const sel = window.getSelection()
      if (!sel || sel.isCollapsed) return
      const range = sel.getRangeAt(0)
      const container = containerRef.current
      if (!container || !container.contains(range.commonAncestorContainer)) return
      const text = sel.toString().trim()
      if (text.length < 2 || text.length > 1000) return

      const fullText = container.innerText
      const idx = fullText.indexOf(text)
      if (idx < 0) return
      const contextBefore = fullText.slice(Math.max(0, idx - 80), idx)
      const contextAfter = fullText.slice(idx + text.length, idx + text.length + 80)
      setDraft({ rect: range.getBoundingClientRect(), text, contextBefore, contextAfter, note: '' })
    }
    document.addEventListener('mouseup', onMouseUp)
    return () => document.removeEventListener('mouseup', onMouseUp)
  }, [])

  const submit = async () => {
    if (!draft) return
    setSaving(true)
    try {
      await create({
        selectedText: draft.text,
        note: draft.note,
        contextBefore: draft.contextBefore || null,
        contextAfter: draft.contextAfter || null,
      })
      setDraft(null)
      window.getSelection()?.removeAllRanges()
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div ref={containerRef} className="markdown-output" />
      {draft ? (
        <DraftPopover
          rect={draft.rect}
          text={draft.text}
          note={draft.note}
          saving={saving}
          onChange={(note) => setDraft((d) => (d ? { ...d, note } : d))}
          onCancel={() => { setDraft(null); window.getSelection()?.removeAllRanges() }}
          onSave={submit}
        />
      ) : null}
      <style jsx global>{`
        [data-ann-id] {
          /* Barely-noticeable light blue (Tailwind sky-200 @ 35%) so the
             quoted text is gently marked without fighting the body copy. */
          background-color: rgb(186 230 253 / 0.35);
          padding: 0.05em 0.1em;
          border-radius: 2px;
          cursor: pointer;
          transition: background-color 0.15s, outline-color 0.15s;
        }
        [data-ann-id]:hover { background-color: rgb(125 211 252 / 0.55); }
        [data-ann-id][data-focused="true"] {
          background-color: rgb(56 189 248 / 0.65);
          outline: 1px solid rgb(2 132 199);
        }
        [data-ann-resolved="true"] { background-color: rgb(187 247 208 / 0.45); }
      `}</style>
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// List: the column on the right. Each card collapsible when text > threshold,
// so stacking many corrections doesn't drown the layout.
// ─────────────────────────────────────────────────────────────────────────────
const QUOTE_TRUNC = 150
const NOTE_TRUNC = 300

export function AnnotationsList() {
  const { annotations, focusedId, setFocusedId, update, remove } = useAnnotations()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingValue, setEditingValue] = useState('')
  const [expanded, setExpanded] = useState<Record<string, { quote?: boolean; note?: boolean }>>({})
  const [filter, setFilter] = useState<'all' | 'open' | 'resolved'>('all')

  const openCount = annotations.filter((a) => !a.resolved).length
  const visible = annotations.filter((a) => {
    if (filter === 'open') return !a.resolved
    if (filter === 'resolved') return a.resolved
    return true
  })

  const toggle = (id: string, key: 'quote' | 'note') =>
    setExpanded((prev) => ({ ...prev, [id]: { ...prev[id], [key]: !prev[id]?.[key] } }))

  return (
    <div className="bg-card border border-border shadow-sm">
      <header className="flex items-center justify-between gap-2 px-3 py-2.5 border-b border-border bg-secondary/30">
        <div className="flex items-center gap-1.5 text-sm font-semibold">
          <MessageSquare className="h-3.5 w-3.5" /> Notes
          <span className="text-xs text-muted-foreground font-normal">
            {annotations.length} · {openCount} open
          </span>
        </div>
        <div className="flex items-center gap-0.5 text-[10px]">
          {(['all', 'open', 'resolved'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-1.5 py-0.5 rounded ${
                filter === f ? 'bg-primary/15 text-primary font-semibold' : 'text-muted-foreground hover:bg-secondary'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </header>

      {annotations.length === 0 ? (
        <div className="p-4 text-xs text-muted-foreground italic">
          Select text in the body to add the first note.
        </div>
      ) : visible.length === 0 ? (
        <div className="p-4 text-xs text-muted-foreground italic">
          No {filter} notes. Switch the filter above to see all.
        </div>
      ) : (
        <ul className="divide-y divide-border max-h-[80vh] overflow-y-auto">
          {visible.map((a) => {
            const isFocused = focusedId === a.id
            const exp = expanded[a.id] ?? {}
            const quoteOver = a.selectedText.length > QUOTE_TRUNC
            const noteOver = a.note.length > NOTE_TRUNC
            const quoteShown = quoteOver && !exp.quote ? a.selectedText.slice(0, QUOTE_TRUNC) + '…' : a.selectedText
            const noteShown = noteOver && !exp.note ? a.note.slice(0, NOTE_TRUNC) + '…' : a.note

            return (
              <li
                key={a.id}
                data-ann-card-id={a.id}
                className={`p-3 transition-colors cursor-pointer ${
                  isFocused ? 'bg-sky-50 dark:bg-sky-900/20'
                            : a.resolved ? 'opacity-70 hover:bg-secondary/40'
                                         : 'hover:bg-secondary/40'
                }`}
                onClick={() => setFocusedId(a.id)}
              >
                <div className="flex items-start gap-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); update(a.id, { resolved: !a.resolved }) }}
                    className="mt-0.5 shrink-0 text-muted-foreground hover:text-emerald-600"
                    aria-label={a.resolved ? 'Reopen note' : 'Mark resolved'}
                    title={a.resolved ? 'Reopen' : 'Mark resolved'}
                  >
                    {a.resolved ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Circle className="h-4 w-4" />}
                  </button>

                  <div className="flex-1 min-w-0">
                    {/* quote */}
                    <blockquote className={`text-[11px] italic text-muted-foreground border-l-2 border-sky-400 pl-2 break-words ${a.resolved ? 'line-through' : ''}`}>
                      "{quoteShown}"
                      {quoteOver ? (
                        <button
                          onClick={(e) => { e.stopPropagation(); toggle(a.id, 'quote') }}
                          className="ml-1 text-primary hover:underline not-italic font-medium"
                        >
                          {exp.quote ? 'show less' : 'show more'}
                        </button>
                      ) : null}
                    </blockquote>

                    {/* note (or inline editor) */}
                    {editingId === a.id ? (
                      <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                        <Textarea
                          value={editingValue}
                          onChange={(e) => setEditingValue(e.target.value)}
                          rows={4}
                          className="text-sm"
                          autoFocus
                        />
                        <div className="mt-1.5 flex justify-end gap-1">
                          <Button size="sm" variant="ghost" onClick={() => setEditingId(null)} className="h-7 gap-1 text-xs">
                            <X className="h-3 w-3" /> Cancel
                          </Button>
                          <Button
                            size="sm"
                            onClick={async () => { await update(a.id, { note: editingValue }); setEditingId(null) }}
                            className="h-7 gap-1 text-xs"
                          >
                            <Check className="h-3 w-3" /> Save
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className={`mt-1.5 text-sm break-words whitespace-pre-wrap ${a.resolved ? 'text-muted-foreground' : ''}`}>
                        {a.note ? (
                          <>
                            {noteShown}
                            {noteOver ? (
                              <button
                                onClick={(e) => { e.stopPropagation(); toggle(a.id, 'note') }}
                                className="ml-1 inline-flex items-center gap-0.5 text-xs text-primary hover:underline font-medium"
                              >
                                {exp.note ? <><ChevronUp className="h-3 w-3" /> show less</> : <><ChevronDown className="h-3 w-3" /> show more</>}
                              </button>
                            ) : null}
                          </>
                        ) : (
                          <span className="italic text-muted-foreground text-xs">(no note)</span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={() => { setEditingId(a.id); setEditingValue(a.note) }}
                      aria-label="Edit note"
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      className="h-6 w-6 text-muted-foreground hover:text-destructive"
                      onClick={() => remove(a.id)}
                      aria-label="Delete note"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// helpers
// ─────────────────────────────────────────────────────────────────────────────
function applyHighlight(el: HTMLElement, ann: Annotation, focused: boolean) {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
  const target = ann.selectedText
  let node: Node | null
  while ((node = walker.nextNode())) {
    const txt = node.textContent ?? ''
    const idx = txt.indexOf(target)
    if (idx < 0) continue
    try {
      const range = document.createRange()
      range.setStart(node, idx)
      range.setEnd(node, idx + target.length)
      const mark = document.createElement('mark')
      mark.dataset.annId = ann.id
      if (focused) mark.dataset.focused = 'true'
      if (ann.resolved) mark.dataset.annResolved = 'true'
      range.surroundContents(mark)
      return
    } catch {
      return
    }
  }
}

function DraftPopover({
  rect, text, note, saving, onChange, onCancel, onSave,
}: {
  rect: DOMRect
  text: string
  note: string
  saving: boolean
  onChange: (v: string) => void
  onCancel: () => void
  onSave: () => void
}) {
  const top = rect.bottom + window.scrollY + 6
  const left = Math.max(8, Math.min(window.innerWidth - 360, rect.left + window.scrollX))
  return (
    <div
      className="absolute z-50 w-[340px] rounded-md border border-border bg-card shadow-lg p-3"
      style={{ top, left }}
      onMouseDown={(e) => e.stopPropagation()}
      onMouseUp={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-1.5 text-xs font-semibold mb-2">
        <MessageSquarePlus className="h-3.5 w-3.5" /> Add note
      </div>
      <blockquote className="text-[11px] italic text-muted-foreground border-l-2 border-sky-400 pl-2 mb-2 max-h-16 overflow-y-auto">
        "{text.length > 180 ? text.slice(0, 180) + '…' : text}"
      </blockquote>
      <Textarea
        autoFocus
        rows={3}
        value={note}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Your fix, comment, or to-do for this selection…"
        className="text-sm"
      />
      <div className="mt-2 flex justify-end gap-1.5">
        <Button size="sm" variant="ghost" onClick={onCancel} disabled={saving} className="h-7 text-xs">
          <X className="h-3 w-3 mr-1" /> Cancel
        </Button>
        <Button size="sm" onClick={onSave} disabled={saving} className="h-7 text-xs">
          {saving ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Check className="h-3 w-3 mr-1" />}
          Save
        </Button>
      </div>
    </div>
  )
}
