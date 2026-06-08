'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Copy, Download, Files, MessageSquareQuote, Sparkles, Trash2, FileType2 } from 'lucide-react'
import { toast } from 'sonner'
import { copyMarkdownAsRich } from '@/lib/markdown'

// Note payload threaded through from the page-side annotation fetch — the
// minimum surface area needed to embed each note next to its anchor in the
// copied markdown. selectedText and contextBefore/After let us pick the
// EXACT occurrence the operator highlighted even when the phrase repeats.
export interface AnnotationForCopy {
  id: string
  selectedText: string
  note: string
  contextBefore: string | null
  contextAfter: string | null
  resolved: boolean
}

// ── Context-similarity scoring (same logic as content-annotations) ──
function commonSuffixLen(a: string, b: string): number {
  let i = 0
  while (i < a.length && i < b.length && a[a.length - 1 - i] === b[b.length - 1 - i]) i++
  return i
}
function commonPrefixLen(a: string, b: string): number {
  let i = 0
  while (i < a.length && i < b.length && a[i] === b[i]) i++
  return i
}

// Build a markdown export with inline footnote-style markers `[1]`, `[2]`,
// … inserted right after each annotated phrase, plus a "Review notes"
// section at the end with the full text of every note. Reviewers can
// scan the article and jump to a note by its number.
function buildAnnotatedMarkdown(brief: string, annotations: AnnotationForCopy[]): string {
  if (annotations.length === 0) return brief

  // For every annotation, locate its EXACT occurrence in the brief using
  // the same flat-text + context scoring we use for the inline highlight.
  // Collect insertion points first, then splice them in reverse so earlier
  // markers' offsets stay valid as we work backward.
  const insertions: { pos: number; marker: string }[] = []

  annotations.forEach((ann, i) => {
    const markerIdx = i + 1
    const positions: number[] = []
    let from = 0
    while (true) {
      const idx = brief.indexOf(ann.selectedText, from)
      if (idx < 0) break
      positions.push(idx)
      from = idx + 1
    }
    if (positions.length === 0) return // text gone from brief — skip inline marker

    let bestPos = positions[0]
    if (positions.length > 1) {
      const storedBefore = ann.contextBefore ?? ''
      const storedAfter = ann.contextAfter ?? ''
      let bestScore = -1
      for (const pos of positions) {
        const actualBefore = brief.slice(Math.max(0, pos - 80), pos)
        const actualAfter = brief.slice(pos + ann.selectedText.length, pos + ann.selectedText.length + 80)
        const score = commonSuffixLen(actualBefore, storedBefore) + commonPrefixLen(actualAfter, storedAfter)
        if (score > bestScore) { bestScore = score; bestPos = pos }
      }
    }

    insertions.push({
      pos: bestPos + ann.selectedText.length,
      marker: ` **[${markerIdx}]**`,
    })
  })

  // Splice insertions in descending order so each one's offset is still
  // valid by the time we apply it (later ones don't shift earlier ones).
  insertions.sort((a, b) => b.pos - a.pos)
  let out = brief
  for (const ins of insertions) {
    out = out.slice(0, ins.pos) + ins.marker + out.slice(ins.pos)
  }

  // Append a Review notes section. Each entry shows the quoted span,
  // the operator's note, and a ✓ Resolved badge if applicable so the
  // reviewer can tell at a glance which items are still open.
  const notesLines = annotations.map((a, i) => {
    const num = i + 1
    const quote = a.selectedText.replace(/\s+/g, ' ').trim()
    const resolvedTag = a.resolved ? ' _(✓ resolved)_' : ''
    const noteBody = a.note.trim() || '_(no note text — text was flagged with empty comment)_'
    return `**[${num}]** “${quote}”${resolvedTag}\n${noteBody}\n`
  })

  const sectionHeader = `## Review notes (${annotations.length})`
  return `${out}\n\n---\n\n${sectionHeader}\n\n${notesLines.join('\n')}`
}

export function ContentActions({
  id,
  brief,
  topic,
  unresolvedAnnotationCount = 0,
  annotations = [],
}: {
  id: string
  brief: string
  topic: string
  unresolvedAnnotationCount?: number
  annotations?: AnnotationForCopy[]
}) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)
  const [duplicating, setDuplicating] = useState(false)
  const [regenerating, setRegenerating] = useState(false)

  const copy = async () => {
    try {
      await copyMarkdownAsRich(brief ?? '')
      toast.success('Copied (rich text + markdown)')
    } catch {
      toast.error('Could not copy')
    }
  }

  // Copy the article AND the annotations: inline footnote markers `[1]`,
  // `[2]`, … get inserted after each highlighted phrase, and a "Review
  // notes" section gets appended with the full text of every note.
  // Reviewers can hand the markdown straight to Google Docs / Notion / a
  // editor without losing the operator's annotations.
  const copyWithNotes = async () => {
    if (annotations.length === 0) {
      toast.error('No notes on this article — use Copy instead.')
      return
    }
    try {
      const annotated = buildAnnotatedMarkdown(brief ?? '', annotations)
      await copyMarkdownAsRich(annotated)
      toast.success(`Copied with ${annotations.length} note${annotations.length === 1 ? '' : 's'} (rich text + markdown)`)
    } catch {
      toast.error('Could not copy')
    }
  }

  // "Open in Google Docs" — copy the article to the clipboard as rich text
  // (HTML + plain markdown fallback), then open a fresh Google Doc in a new
  // tab. The operator pastes with ⌘V; Google Docs preserves headings, bold,
  // links, lists, tables on paste. If the article has notes attached we
  // include the annotated variant so reviewers see inline [1] / [2] markers
  // and a Review-notes section at the end — same payload Copy + notes uses.
  // Zero OAuth, zero new deps; same pattern as the Reports page.
  const openInGoogleDocs = async () => {
    const payload = annotations.length > 0
      ? buildAnnotatedMarkdown(brief ?? '', annotations)
      : (brief ?? '')
    if (!payload) {
      toast.error('Nothing to open — article is empty.')
      return
    }
    // Open the tab synchronously inside the click handler so popup blockers
    // let it through; the clipboard write races alongside.
    const tab = window.open('https://docs.google.com/document/create', '_blank', 'noopener,noreferrer')
    try {
      await copyMarkdownAsRich(payload)
      const notesNote = annotations.length > 0
        ? ` (with ${annotations.length} note${annotations.length === 1 ? '' : 's'})`
        : ''
      toast.success(`Article copied${notesNote} — paste in the new tab with ⌘V`, { duration: 6000 })
    } catch {
      toast.error('Could not copy article — open Google Docs and try again.')
    }
    if (!tab) {
      toast.message('Popup blocked — open docs.google.com/document/create manually, then paste.', { duration: 8000 })
    }
  }

  const download = () => {
    try {
      const blob = new Blob([brief ?? ''], { type: 'text/markdown;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const safeName = (topic ?? 'brief').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60)
      a.href = url
      a.download = `${safeName || 'brief'}.md`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Could not download')
    }
  }

  const remove = async () => {
    if (!confirm('Delete this brief?')) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/content/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        toast.error('Could not delete')
        return
      }
      toast.success('Deleted')
      router.push('/content')
      router.refresh()
    } finally {
      setDeleting(false)
    }
  }

  // Send every inline annotation back to the model + the current article;
  // model rewrites the article applying every correction. Each note gets
  // promoted to project-level CorrectionMemo so the same mistake doesn't
  // repeat on the next generation. Annotations get auto-resolved.
  const regenerateFromNotes = async () => {
    if (unresolvedAnnotationCount === 0) {
      toast.error('Add at least one inline note before regenerating.')
      return
    }
    if (!confirm(`Rewrite the article applying all ${unresolvedAnnotationCount} pending note${unresolvedAnnotationCount === 1 ? '' : 's'}? The current text will be replaced.`)) return
    setRegenerating(true)
    try {
      const res = await fetch(`/api/content/${id}/regenerate-from-notes`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data?.error ?? 'Could not regenerate')
        return
      }
      const memoMsg = data.memosAdded
        ? ` · ${data.memosAdded} new memo${data.memosAdded === 1 ? '' : 's'} added to project memory (${data.totalMemoSize} total)`
        : ''
      const violationsMsg = data.violations?.total
        ? ` · ${data.violations.total} style violation${data.violations.total === 1 ? '' : 's'} remaining — review`
        : ''
      toast.success(`Article rewritten with ${data.annotationsApplied} correction${data.annotationsApplied === 1 ? '' : 's'} applied${memoMsg}${violationsMsg}`)
      router.refresh()
    } catch {
      toast.error('Could not regenerate')
    } finally {
      setRegenerating(false)
    }
  }

  // Server copies every field (brief, briefData, folder, notes, ICPs,
  // annotations) into a new draft titled "Copy of …" and navigates the
  // operator straight to it. Annotations come along because the body is
  // identical at the moment of cloning so every anchor still matches.
  const duplicate = async () => {
    setDuplicating(true)
    try {
      const res = await fetch(`/api/content/${id}/duplicate`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.id) {
        toast.error(data?.error ?? 'Could not duplicate')
        return
      }
      toast.success(`Duplicated as "${data.topic}"`)
      router.push(`/content/${data.id}`)
      router.refresh()
    } catch {
      toast.error('Could not duplicate')
    } finally {
      setDuplicating(false)
    }
  }

  const disabled = deleting || duplicating || regenerating
  return (
    <div className="flex flex-wrap gap-2">
      {unresolvedAnnotationCount > 0 ? (
        <Button
          variant="default"
          onClick={regenerateFromNotes}
          loading={regenerating}
          disabled={disabled}
          title={`Rewrite using all ${unresolvedAnnotationCount} pending note${unresolvedAnnotationCount === 1 ? '' : 's'}`}
        >
          <Sparkles className="h-4 w-4" />
          {regenerating ? 'Regenerating…' : `Regenerate from ${unresolvedAnnotationCount} note${unresolvedAnnotationCount === 1 ? '' : 's'}`}
        </Button>
      ) : null}
      <Button variant="outline" onClick={copy} disabled={disabled}>
        <Copy className="h-4 w-4" /> Copy
      </Button>
      {annotations.length > 0 ? (
        <Button
          variant="outline"
          onClick={copyWithNotes}
          disabled={disabled}
          title={`Copy article with inline note markers + a list of all ${annotations.length} note${annotations.length === 1 ? '' : 's'} at the end`}
        >
          <MessageSquareQuote className="h-4 w-4" />
          Copy + notes ({annotations.length})
        </Button>
      ) : null}
      <Button
        variant="outline"
        onClick={openInGoogleDocs}
        disabled={disabled}
        title={
          annotations.length > 0
            ? `Copy article + ${annotations.length} note${annotations.length === 1 ? '' : 's'} and open a new Google Doc`
            : 'Copy article and open a new Google Doc'
        }
      >
        <FileType2 className="h-4 w-4" /> Open in Google Docs
      </Button>
      <Button variant="outline" onClick={download} disabled={disabled}>
        <Download className="h-4 w-4" /> Download
      </Button>
      <Button variant="outline" onClick={duplicate} loading={duplicating} disabled={disabled}>
        <Files className="h-4 w-4" /> Duplicate
      </Button>
      <Button variant="outline" onClick={remove} loading={deleting} disabled={disabled} className="text-destructive hover:text-destructive">
        <Trash2 className="h-4 w-4" /> Delete
      </Button>
    </div>
  )
}
