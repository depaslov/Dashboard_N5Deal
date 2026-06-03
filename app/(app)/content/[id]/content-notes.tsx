'use client'

import { useEffect, useRef, useState } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { Check, Loader2, NotebookPen } from 'lucide-react'
import { toast } from 'sonner'

interface Props {
  id: string
  initialNotes: string
}

// Sticky scratchpad shown next to the rendered content. Auto-saves ~1.5s
// after the user stops typing. Whatever lives here is operator-only — it
// never gets sent to the LLM or appears in generation output.
export function ContentNotes({ id, initialNotes }: Props) {
  const [value, setValue] = useState(initialNotes ?? '')
  const [saved, setSaved] = useState(initialNotes ?? '')
  const [state, setState] = useState<'idle' | 'pending' | 'saving' | 'saved' | 'error'>('idle')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const dirty = value !== saved

  // Debounced auto-save: every keystroke resets a 1500ms timer; when the
  // timer fires we PATCH the row. If the user keeps typing, the previous
  // timer is cleared so we don't make a save call per character.
  useEffect(() => {
    if (!dirty) return
    setState('pending')
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      setState('saving')
      try {
        const res = await fetch(`/api/content/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notes: value }),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          toast.error(data?.error ?? 'Could not save notes')
          setState('error')
          return
        }
        setSaved(value)
        setState('saved')
      } catch {
        setState('error')
        toast.error('Could not save notes')
      }
    }, 1500)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [value, dirty, id])

  return (
    <div className="bg-card border border-border shadow-sm p-4 h-full flex flex-col">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 text-sm font-semibold">
          <NotebookPen className="h-3.5 w-3.5" /> Notes
        </div>
        <StatusBadge state={state} dirty={dirty} />
      </div>
      <p className="text-[10px] text-muted-foreground mb-2">
        Personal scratchpad — feedback, to-dos, paste-in fixes. Never sent to the AI.
      </p>
      <Textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={'• Rewrite second paragraph\n• Confirm BVI capital figure\n• Ask client about disclaimer wording\n• …'}
        className="flex-1 min-h-[24rem] font-mono text-xs resize-none"
      />
      <p className="text-[10px] text-muted-foreground mt-1.5 tabular-nums text-right">
        {value.length.toLocaleString()} chars
      </p>
    </div>
  )
}

function StatusBadge({ state, dirty }: { state: 'idle' | 'pending' | 'saving' | 'saved' | 'error'; dirty: boolean }) {
  if (state === 'saving') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" /> Saving…
      </span>
    )
  }
  if (state === 'pending' && dirty) {
    return <span className="text-[10px] text-amber-600 dark:text-amber-400">Unsaved changes</span>
  }
  if (state === 'saved' && !dirty) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 dark:text-emerald-300">
        <Check className="h-3 w-3" /> Saved
      </span>
    )
  }
  if (state === 'error') {
    return <span className="text-[10px] text-destructive">Save failed</span>
  }
  return null
}
