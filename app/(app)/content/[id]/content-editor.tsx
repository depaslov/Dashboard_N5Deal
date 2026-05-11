'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Pencil, Save, X, Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { renderMarkdown } from '@/lib/markdown'

interface Props {
  id: string
  initialBrief: string
}

// Inline view/edit toggle for a piece of GeneratedContent. Default shows the
// rendered markdown; "Edit" reveals a textarea with the raw source plus a
// live-preview toggle. Save sends a PATCH to /api/content/[id].
export function ContentEditor({ id, initialBrief }: Props) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(initialBrief)
  const [saved, setSaved] = useState(initialBrief)
  const [saving, setSaving] = useState(false)
  const [showPreview, setShowPreview] = useState(false)

  const dirty = draft !== saved

  const save = async () => {
    if (!dirty) {
      setEditing(false)
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/content/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ generatedBrief: draft }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data?.error ?? 'Could not save')
        return
      }
      setSaved(draft)
      setEditing(false)
      toast.success('Saved')
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  const cancel = () => {
    if (dirty && !confirm('Discard unsaved changes?')) return
    setDraft(saved)
    setEditing(false)
    setShowPreview(false)
  }

  if (!editing) {
    return (
      <div>
        <div className="flex items-center justify-between">
          <h2 className="font-display font-semibold text-lg tracking-tight">Generated content</h2>
          <Button variant="outline" size="sm" onClick={() => setEditing(true)} className="gap-1.5">
            <Pencil className="h-3.5 w-3.5" /> Edit
          </Button>
        </div>
        <article
          className="markdown-output mt-4"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(saved) }}
        />
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="font-display font-semibold text-lg tracking-tight">Editing</h2>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowPreview((v) => !v)}
            className="gap-1.5"
          >
            <Eye className="h-3.5 w-3.5" /> {showPreview ? 'Hide preview' : 'Show preview'}
          </Button>
          <Button variant="outline" size="sm" onClick={cancel} disabled={saving} className="gap-1.5">
            <X className="h-3.5 w-3.5" /> Cancel
          </Button>
          <Button size="sm" onClick={save} disabled={saving || !dirty} className="gap-1.5">
            <Save className="h-3.5 w-3.5" /> {saving ? 'Saving…' : dirty ? 'Save' : 'Saved'}
          </Button>
        </div>
      </div>

      <p className="mt-1 text-xs text-muted-foreground">
        Markdown supported. {draft.length.toLocaleString()} chars
        {dirty ? <span className="ml-1 text-amber-600">• unsaved changes</span> : null}
      </p>

      <div className={showPreview ? 'mt-3 grid gap-3 lg:grid-cols-2' : 'mt-3'}>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          spellCheck={false}
          className="w-full min-h-[40rem] font-mono text-xs p-3 border border-border bg-background rounded-md resize-y focus:outline-none focus:ring-2 focus:ring-ring"
        />
        {showPreview ? (
          <article
            className="markdown-output min-h-[40rem] p-4 border border-border bg-background rounded-md overflow-y-auto"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(draft) }}
          />
        ) : null}
      </div>
    </div>
  )
}
