'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Pencil, Save, X, Eye, Sparkles, RefreshCw, Wand2, Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { renderMarkdown } from '@/lib/markdown'
import { AnnotationsBody } from './content-annotations'
import { ContentDiffView } from './content-diff-view'
import { Check, Undo2 } from 'lucide-react'

interface Props {
  id: string
  initialBrief: string
  // When set, the operator has a regenerate-from-notes diff pending. The
  // editor renders a banner + the ContentDiffView until they Accept (clears
  // previousBrief) or Revert (restores it as the live brief).
  previousBrief?: string | null
}

// Inline view/edit toggle + AI revision tools for a piece of GeneratedContent.
//
// Three modes:
// 1. View (default)       — rendered markdown, with "Edit" + "Regenerate" + "Request edit" actions
// 2. Manual edit          — raw markdown textarea with live preview, Save / Cancel
// 3. AI revision panel    — collapsible textarea where the user types instructions
//                           ("rewrite intro shorter") and clicks Apply. Calls
//                           POST /api/content/[id]/revise.
//
// The Regenerate button is a one-click preset that asks the LLM to rewrite
// the same content end-to-end with substantively varied structure/wording.
export function ContentEditor({ id, initialBrief, previousBrief }: Props) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(initialBrief)
  const [saved, setSaved] = useState(initialBrief)
  const [saving, setSaving] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  // Diff state — when previousBrief is set, default to showing the diff so
  // the operator immediately sees what changed. Toggle between diff and
  // clean view; Accept / Revert call /api/content/[id]/regeneration.
  const [showDiff, setShowDiff] = useState(true)
  const [resolvingDiff, setResolvingDiff] = useState<'accept' | 'revert' | null>(null)

  const hasDiff = !!previousBrief && previousBrief !== initialBrief

  async function resolveDiff(action: 'accept' | 'revert') {
    setResolvingDiff(action)
    try {
      const res = await fetch(`/api/content/${id}/regeneration`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data?.error ?? `Could not ${action}`)
        return
      }
      toast.success(action === 'accept' ? 'Changes accepted' : 'Reverted to previous version')
      router.refresh()
    } catch {
      toast.error(`Could not ${action}`)
    } finally {
      setResolvingDiff(null)
    }
  }

  // AI revision state
  const [revisePanel, setRevisePanel] = useState(false)
  const [instructions, setInstructions] = useState('')
  const [regenerating, setRegenerating] = useState(false)
  const [revising, setRevising] = useState(false)
  const busy = regenerating || revising

  const dirty = draft !== saved

  async function save() {
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

  function cancel() {
    if (dirty && !confirm('Discard unsaved changes?')) return
    setDraft(saved)
    setEditing(false)
    setShowPreview(false)
  }

  async function callRevise(mode: 'regenerate' | 'edit', instr?: string) {
    if (mode === 'regenerate') setRegenerating(true); else setRevising(true)
    try {
      const res = await fetch(`/api/content/${id}/revise`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, instructions: instr }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data?.error ?? 'Revision failed')
        return
      }
      const next = data?.content?.generatedBrief as string
      if (next) {
        setSaved(next)
        setDraft(next)
      }
      toast.success(mode === 'regenerate' ? 'Regenerated' : 'Revised')
      if (mode === 'edit') {
        setInstructions('')
        setRevisePanel(false)
      }
      router.refresh()
    } finally {
      setRegenerating(false); setRevising(false)
    }
  }

  if (!editing) {
    return (
      <div>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h2 className="font-display font-semibold text-lg tracking-tight">Generated content</h2>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => callRevise('regenerate')}
              disabled={busy}
              className="gap-1.5"
              title="Rewrite end-to-end with varied structure"
            >
              {regenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              {regenerating ? 'Regenerating…' : 'Regenerate'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRevisePanel((v) => !v)}
              disabled={busy}
              className="gap-1.5"
              title="Apply targeted edits via natural-language instructions"
            >
              <Wand2 className="h-3.5 w-3.5" /> Request edit
            </Button>
            <Button variant="outline" size="sm" onClick={() => setEditing(true)} className="gap-1.5">
              <Pencil className="h-3.5 w-3.5" /> Edit manually
            </Button>
          </div>
        </div>

        {revisePanel ? (
          <div className="mt-4 rounded-lg border border-primary/30 bg-primary/5 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <h3 className="font-semibold text-sm">What should be changed?</h3>
            </div>
            <Textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={3}
              placeholder='e.g. "Rewrite the intro to be more direct" · "Shorten section 2 by half" · "Add a paragraph about Estonian EMI timelines" · "Make the tone slightly more conversational"'
              className="text-sm"
              disabled={busy}
            />
            <div className="mt-3 flex items-center justify-between gap-2 flex-wrap">
              <p className="text-[11px] text-muted-foreground">
                The model keeps every internal link, named source, and the disclaimer. Compliance + humanization rules apply.
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setInstructions(''); setRevisePanel(false) }}
                  disabled={busy}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={() => callRevise('edit', instructions.trim())}
                  disabled={busy || !instructions.trim()}
                  className="gap-1.5"
                >
                  {revising ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
                  {revising ? 'Applying…' : 'Apply revision'}
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        {/* Pending-regeneration banner — appears whenever previousBrief is
            set. Lets the operator toggle between diff view and clean view,
            then accept or revert. */}
        {hasDiff ? (
          <div className="mt-4 border border-amber-500/40 bg-amber-50 dark:bg-amber-950/30 rounded-md p-3 flex items-center gap-3 flex-wrap">
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                Pending regeneration
              </div>
              <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                {showDiff
                  ? 'Showing inline diff — deletions strikethrough, insertions highlighted. Accept to keep the new version, Revert to roll back.'
                  : 'Showing the new version only. Toggle "Show diff" to compare with the previous draft.'}
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowDiff((v) => !v)}
                disabled={resolvingDiff !== null}
                className="gap-1.5"
              >
                {showDiff ? 'Hide diff' : 'Show diff'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => resolveDiff('revert')}
                disabled={resolvingDiff !== null}
                className="gap-1.5 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-950"
              >
                {resolvingDiff === 'revert' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Undo2 className="h-3.5 w-3.5" />}
                {resolvingDiff === 'revert' ? 'Reverting…' : 'Revert'}
              </Button>
              <Button
                size="sm"
                onClick={() => resolveDiff('accept')}
                disabled={resolvingDiff !== null}
                className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {resolvingDiff === 'accept' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                {resolvingDiff === 'accept' ? 'Accepting…' : 'Accept'}
              </Button>
            </div>
          </div>
        ) : null}

        <div className="mt-4">
          {hasDiff && showDiff && previousBrief ? (
            <ContentDiffView previousBrief={previousBrief} currentBrief={saved} />
          ) : (
            <AnnotationsBody markdown={saved} />
          )}
        </div>
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
