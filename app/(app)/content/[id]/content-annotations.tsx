'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { renderMarkdown } from '@/lib/markdown'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  MessageSquarePlus, Check, X, Trash2, Pencil, MessageSquare, CheckCircle2, Circle, Loader2,
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

interface Props {
  contentId: string
  markdown: string
  initialAnnotations: Annotation[]
}

// Inline annotations:
//   - select text in the rendered markdown → floating "Add note" button appears
//   - clicking it opens an input popover near the selection
//   - saved annotations:
//       * highlight the selected text inline (yellow background)
//       * appear in a list below; clicking a list entry scrolls + focuses the highlight
export function ContentAnnotations({ contentId, markdown, initialAnnotations }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [annotations, setAnnotations] = useState<Annotation[]>(initialAnnotations)
  const [draft, setDraft] = useState<{ rect: DOMRect; text: string; contextBefore: string; contextAfter: string; note: string } | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingValue, setEditingValue] = useState('')
  const [focusedId, setFocusedId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // ── Render markdown + inline highlights ───────────────────────────────────
  // Whenever the body OR the annotation set changes, re-render the HTML from
  // markdown source (resets any previous highlights), then walk text nodes to
  // wrap each annotation's selectedText in a <mark>. Wrapping by re-rendering
  // is safe even though we use dangerouslySetInnerHTML — React doesn't manage
  // these children, we do.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    el.innerHTML = renderMarkdown(markdown)
    for (const ann of annotations) {
      applyHighlight(el, ann, ann.id === focusedId)
    }
  }, [markdown, annotations, focusedId])

  // ── Click on a highlight → focus the matching list item ──────────────────
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
      // scroll the corresponding list card into view
      requestAnimationFrame(() => {
        const card = document.querySelector(`[data-ann-card-id="${id}"]`)
        card?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      })
    }
    el.addEventListener('click', onClick)
    return () => el.removeEventListener('click', onClick)
  }, [annotations])

  // ── Selection handler ───────────────────────────────────────────────────
  // On mouseup anywhere in the document, check if there's a non-empty selection
  // inside our container. If yes — capture text + nearby context and surface
  // the "Add note" floating button. The popover opens an inline input next to it.
  useEffect(() => {
    const onMouseUp = () => {
      const sel = window.getSelection()
      if (!sel || sel.isCollapsed) return
      const range = sel.getRangeAt(0)
      const container = containerRef.current
      if (!container || !container.contains(range.commonAncestorContainer)) return

      const text = sel.toString().trim()
      if (text.length < 2 || text.length > 1000) return

      // Build context: take the container's full text and slice ~80 chars before/after.
      const fullText = container.innerText
      const idx = fullText.indexOf(text)
      if (idx < 0) return
      const contextBefore = fullText.slice(Math.max(0, idx - 80), idx)
      const contextAfter = fullText.slice(idx + text.length, idx + text.length + 80)

      const rect = range.getBoundingClientRect()
      setDraft({ rect, text, contextBefore, contextAfter, note: '' })
    }
    document.addEventListener('mouseup', onMouseUp)
    return () => document.removeEventListener('mouseup', onMouseUp)
  }, [])

  // ── API actions ─────────────────────────────────────────────────────────
  const createAnnotation = useCallback(async () => {
    if (!draft) return
    setSaving(true)
    try {
      const res = await fetch(`/api/content/${contentId}/annotations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selectedText: draft.text,
          note: draft.note,
          contextBefore: draft.contextBefore || null,
          contextAfter: draft.contextAfter || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data?.error ?? 'Could not save'); return }
      setAnnotations((prev) => [...prev, data.annotation])
      setDraft(null)
      window.getSelection()?.removeAllRanges()
      toast.success('Note added')
    } finally {
      setSaving(false)
    }
  }, [draft, contentId])

  const updateAnnotation = useCallback(async (id: string, patch: { note?: string; resolved?: boolean }) => {
    const res = await fetch(`/api/annotations/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    const data = await res.json()
    if (!res.ok) { toast.error(data?.error ?? 'Could not update'); return }
    setAnnotations((prev) => prev.map((a) => (a.id === id ? data.annotation : a)))
  }, [])

  const deleteAnnotation = useCallback(async (id: string) => {
    if (!confirm('Delete this note?')) return
    const res = await fetch(`/api/annotations/${id}`, { method: 'DELETE' })
    if (!res.ok) { toast.error('Could not delete'); return }
    setAnnotations((prev) => prev.filter((a) => a.id !== id))
    toast.success('Deleted')
  }, [])

  const openCount = useMemo(() => annotations.filter((a) => !a.resolved).length, [annotations])

  return (
    <div className="space-y-4">
      {/* Rendered markdown body with inline highlights */}
      <div
        ref={containerRef}
        className="markdown-output relative"
      />

      {/* Floating "Add note" popover anchored to the selection */}
      {draft ? (
        <DraftPopover
          rect={draft.rect}
          text={draft.text}
          note={draft.note}
          saving={saving}
          onChange={(note) => setDraft((d) => (d ? { ...d, note } : d))}
          onCancel={() => { setDraft(null); window.getSelection()?.removeAllRanges() }}
          onSave={createAnnotation}
        />
      ) : null}

      {/* Annotation list */}
      <div className="border-t border-border pt-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold inline-flex items-center gap-1.5">
            <MessageSquare className="h-3.5 w-3.5" /> Notes
            <span className="text-xs text-muted-foreground font-normal">
              {annotations.length} total · {openCount} open
            </span>
          </h3>
          <p className="text-[10px] text-muted-foreground">
            Select text in the body above to add a note
          </p>
        </div>

        {annotations.length === 0 ? (
          <p className="text-xs text-muted-foreground italic py-3">
            No notes yet. Highlight any part of the text above to add the first one.
          </p>
        ) : (
          <div className="space-y-2">
            {annotations.map((a) => (
              <div
                key={a.id}
                data-ann-card-id={a.id}
                className={`rounded border p-3 transition-colors ${
                  focusedId === a.id ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/20'
                                     : a.resolved ? 'border-border bg-card opacity-70'
                                                  : 'border-border bg-card'
                }`}
              >
                <div className="flex items-start gap-2">
                  <button
                    onClick={() => updateAnnotation(a.id, { resolved: !a.resolved })}
                    className="mt-0.5 shrink-0 text-muted-foreground hover:text-emerald-600"
                    aria-label={a.resolved ? 'Reopen' : 'Mark resolved'}
                    title={a.resolved ? 'Reopen note' : 'Mark as resolved'}
                  >
                    {a.resolved ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Circle className="h-4 w-4" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <blockquote className={`text-xs italic text-muted-foreground border-l-2 border-amber-400 pl-2 ${a.resolved ? 'line-through' : ''}`}>
                      "{a.selectedText.length > 200 ? a.selectedText.slice(0, 200) + '…' : a.selectedText}"
                    </blockquote>

                    {editingId === a.id ? (
                      <div className="mt-2">
                        <Textarea
                          value={editingValue}
                          onChange={(e) => setEditingValue(e.target.value)}
                          rows={3}
                          className="text-sm"
                          autoFocus
                        />
                        <div className="mt-1.5 flex justify-end gap-1">
                          <Button size="sm" variant="ghost" onClick={() => setEditingId(null)} className="h-7 gap-1 text-xs">
                            <X className="h-3 w-3" /> Cancel
                          </Button>
                          <Button
                            size="sm"
                            onClick={async () => { await updateAnnotation(a.id, { note: editingValue }); setEditingId(null) }}
                            className="h-7 gap-1 text-xs"
                          >
                            <Check className="h-3 w-3" /> Save
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p className={`mt-1.5 text-sm whitespace-pre-wrap ${a.resolved ? 'text-muted-foreground' : ''}`}>
                        {a.note || <span className="italic text-muted-foreground">(no note)</span>}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
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
                      onClick={() => deleteAnnotation(a.id)}
                      aria-label="Delete note"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Highlight styles */}
      <style jsx global>{`
        [data-ann-id] {
          background-color: rgb(254 240 138 / 0.7);
          padding: 0.05em 0.1em;
          border-radius: 2px;
          cursor: pointer;
          transition: background-color 0.15s;
        }
        [data-ann-id]:hover {
          background-color: rgb(252 211 77 / 0.85);
        }
        [data-ann-id][data-focused="true"] {
          background-color: rgb(251 191 36 / 0.95);
          outline: 1px solid rgb(217 119 6);
        }
        [data-ann-resolved="true"] {
          background-color: rgb(187 247 208 / 0.5);
        }
      `}</style>
    </div>
  )
}

// Walks text nodes inside `el`, finds the first that contains `ann.selectedText`,
// and wraps that occurrence with <mark data-ann-id="..."/>. Single-text-node
// matches only — selections that span multiple paragraphs are not highlighted
// (they still exist as notes in the list, just no inline marker).
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
      // surroundContents throws if the range partially covers non-text nodes —
      // skip silently. The annotation still lives in the list.
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
  // Anchor below-right of the selection; clamp to viewport.
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
      <blockquote className="text-[11px] italic text-muted-foreground border-l-2 border-amber-400 pl-2 mb-2 max-h-16 overflow-y-auto">
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
