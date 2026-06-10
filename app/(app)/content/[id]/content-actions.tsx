'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
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
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [deleting, setDeleting] = useState(false)
  const [duplicating, setDuplicating] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [creatingDoc, setCreatingDoc] = useState(false)

  // After the operator returns from the Google consent screen the callback
  // appends ?g_oauth=ok|?g_oauth_error=… to the current URL. Surface the
  // outcome as a toast and strip the noisy param so it doesn't survive a
  // refresh. The Open-in-Docs button picks up the new connection state the
  // next time it's clicked.
  useEffect(() => {
    const ok = searchParams.get('g_oauth')
    const err = searchParams.get('g_oauth_error')
    if (!ok && !err) return
    if (ok === 'ok') toast.success('Google account connected — click "Open in Google Docs" again to create the doc.', { duration: 6000 })
    if (err) toast.error(`Google connection failed: ${err}`)
    // Strip the query param without firing a navigation event.
    const next = new URLSearchParams(searchParams.toString())
    next.delete('g_oauth')
    next.delete('g_oauth_error')
    const qs = next.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname)
  }, [searchParams, pathname, router])

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

  // "Open in Google Docs" — server-side create via Drive API. First click:
  // check /api/google/status; if not connected, kick off OAuth (returnTo
  // current path so the operator lands back here after consent). If already
  // connected, POST the article to /api/google/docs/create — server creates
  // a real Google Doc in the operator's Drive, returns the doc URL, we open
  // it in a new tab. If the article has notes, the ANNOTATED variant is
  // sent (inline [N] markers + Review-notes section) so reviewers see them
  // inline in Docs.
  const openInGoogleDocs = async () => {
    const payload = annotations.length > 0
      ? buildAnnotatedMarkdown(brief ?? '', annotations)
      : (brief ?? '')
    if (!payload) {
      toast.error('Nothing to open — article is empty.')
      return
    }
    setCreatingDoc(true)
    try {
      const status = await fetch('/api/google/status').then((r) => r.json()).catch(() => null)
      if (!status?.configured) {
        toast.error('Google Drive integration is not configured on the server. Ask the admin to set GOOGLE_CLIENT_ID / SECRET / REDIRECT_URI.')
        return
      }
      if (!status.connected) {
        const returnTo = pathname + (searchParams.toString() ? `?${searchParams.toString()}` : '')
        window.location.href = `/api/auth/google/start?returnTo=${encodeURIComponent(returnTo)}`
        return
      }
      // Open the tab synchronously BEFORE the await so popup blockers let
      // it through; we point it at about:blank first, then redirect once
      // the doc id comes back.
      const tab = window.open('about:blank', '_blank', 'noopener,noreferrer')
      const res = await fetch('/api/google/docs/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'markdown', title: topic || 'Article', markdown: payload }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.docUrl) {
        if (tab) tab.close()
        if (data?.code === 'not_connected') {
          // Edge case: status said connected but the create call disagreed
          // (token revoked between calls). Kick OAuth again.
          const returnTo = pathname + (searchParams.toString() ? `?${searchParams.toString()}` : '')
          window.location.href = `/api/auth/google/start?returnTo=${encodeURIComponent(returnTo)}`
          return
        }
        toast.error(data?.error ?? 'Could not create Google Doc')
        return
      }
      if (tab) {
        tab.location.href = data.docUrl
      } else {
        // Popup blocked — open via location instead.
        window.open(data.docUrl, '_blank', 'noopener,noreferrer')
      }
      const notesNote = annotations.length > 0
        ? ` (with ${annotations.length} note${annotations.length === 1 ? '' : 's'})`
        : ''
      toast.success(`Google Doc created${notesNote} — opening now…`)
    } finally {
      setCreatingDoc(false)
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

  const disabled = deleting || duplicating || regenerating || creatingDoc
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
        loading={creatingDoc}
        disabled={disabled}
        title={
          annotations.length > 0
            ? `Create a Google Doc with the article + ${annotations.length} note${annotations.length === 1 ? '' : 's'} in your Drive`
            : 'Create a Google Doc with the article in your Drive'
        }
      >
        <FileType2 className="h-4 w-4" />
        {creatingDoc ? 'Creating…' : 'Open in Google Docs'}
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
