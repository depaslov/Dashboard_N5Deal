'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Copy, Download, Files, Sparkles, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { copyMarkdownAsRich } from '@/lib/markdown'

export function ContentActions({
  id,
  brief,
  topic,
  unresolvedAnnotationCount = 0,
}: {
  id: string
  brief: string
  topic: string
  unresolvedAnnotationCount?: number
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
