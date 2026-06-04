'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'

// Available colour palette. Keys match the values stored in
// GeneratedContent.colorTag and the enum in /api/content/[id] PATCH schema —
// keep all three in sync when adding / removing a colour.
export type ColorTag = 'gray' | 'red' | 'orange' | 'amber' | 'emerald' | 'sky' | 'violet'

interface PaletteEntry { key: ColorTag; label: string; dot: string; ring: string; suggested: string }
const PALETTE: PaletteEntry[] = [
  { key: 'gray',    label: 'Neutral',     dot: 'bg-slate-400',   ring: 'ring-slate-400',   suggested: 'No status' },
  { key: 'red',     label: 'Blocked',     dot: 'bg-red-500',     ring: 'ring-red-500',     suggested: 'Urgent / can\'t publish' },
  { key: 'orange',  label: 'Notes',       dot: 'bg-orange-500',  ring: 'ring-orange-500',  suggested: 'Notes / corrections pending' },
  { key: 'amber',   label: 'Review',      dot: 'bg-amber-500',   ring: 'ring-amber-500',   suggested: 'Waiting on review' },
  { key: 'emerald', label: 'Done',        dot: 'bg-emerald-500', ring: 'ring-emerald-500', suggested: 'Approved / published' },
  { key: 'sky',     label: 'In progress', dot: 'bg-sky-500',     ring: 'ring-sky-500',     suggested: 'Active drafting' },
  { key: 'violet',  label: 'Custom',      dot: 'bg-violet-500',  ring: 'ring-violet-500',  suggested: 'Anything else' },
]

interface Props {
  contentId: string
  initialColor: ColorTag | null
  size?: 'sm' | 'md'
  /** When true (default) the popover opens on click. Pass false for read-only display. */
  editable?: boolean
}

/**
 * Small coloured dot rendered next to a content row's title. Clicking the
 * dot opens a tiny palette popover; selecting a colour PATCHes the row and
 * refreshes the page so other surfaces re-render with the new tag.
 *
 * The button's click handler stops propagation so it can sit inside an
 * <a>-wrapped row without navigating.
 */
export function ColorTagDot({ contentId, initialColor, size = 'md', editable = true }: Props) {
  const router = useRouter()
  const [color, setColor] = useState<ColorTag | null>(initialColor)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const current = color ? PALETTE.find((p) => p.key === color) : null
  const dotSize = size === 'sm' ? 'w-2.5 h-2.5' : 'w-3 h-3'
  const buttonSize = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5'

  async function setTag(next: ColorTag | null) {
    if (next === color) { setOpen(false); return }
    setSaving(true)
    const previous = color
    setColor(next) // optimistic — revert below on failure
    try {
      const res = await fetch(`/api/content/${contentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ colorTag: next }),
      })
      if (!res.ok) {
        setColor(previous)
        const data = await res.json().catch(() => ({}))
        toast.error(data?.error ?? 'Could not save colour tag')
        return
      }
      setOpen(false)
      // Refresh so other components reading the colorTag (detail page,
      // sibling row etc.) re-render with the new value too.
      router.refresh()
    } catch {
      setColor(previous)
      toast.error('Could not save colour tag')
    } finally {
      setSaving(false)
    }
  }

  // Non-editable mode: just render the dot, no interactivity.
  if (!editable) {
    return current ? (
      <span
        className={cn('inline-block rounded-full shrink-0', dotSize, current.dot)}
        title={current.label}
        aria-label={`Colour tag: ${current.label}`}
      />
    ) : (
      <span
        className={cn('inline-block rounded-full border border-dashed border-border shrink-0', dotSize)}
        aria-label="No colour tag"
      />
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); e.preventDefault() }}
          disabled={saving}
          aria-label={current ? `Colour tag: ${current.label}. Click to change.` : 'Add colour tag'}
          title={current ? `${current.label} — ${current.suggested}` : 'Add colour tag'}
          className={cn(
            'inline-flex items-center justify-center rounded-full shrink-0 transition-all',
            buttonSize,
            current
              ? cn('ring-2 ring-offset-1 ring-offset-background', current.ring, 'hover:scale-110')
              : 'border border-dashed border-border hover:border-foreground/40 hover:bg-muted',
          )}
        >
          {current ? (
            <span className={cn('rounded-full', dotSize, current.dot)} />
          ) : null}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-56 p-1.5"
        align="start"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold px-2 py-1">
          Status colour
        </div>
        <div className="flex flex-col gap-0.5">
          {PALETTE.map((p) => {
            const active = color === p.key
            return (
              <button
                key={p.key}
                type="button"
                onClick={() => setTag(p.key)}
                disabled={saving}
                className={cn(
                  'flex items-center gap-2 px-2 py-1.5 rounded text-left transition-colors',
                  active ? 'bg-muted' : 'hover:bg-muted/60',
                )}
              >
                <span className={cn('rounded-full w-3 h-3 shrink-0', p.dot)} />
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-medium leading-tight">{p.label}</span>
                  <span className="block text-[10px] text-muted-foreground leading-tight">{p.suggested}</span>
                </span>
                {active ? <Check className="h-3.5 w-3.5 text-foreground shrink-0" /> : null}
              </button>
            )
          })}
        </div>
        {color ? (
          <>
            <div className="border-t border-border my-1" />
            <button
              type="button"
              onClick={() => setTag(null)}
              disabled={saving}
              className="flex items-center gap-2 px-2 py-1.5 rounded w-full text-left text-xs text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            >
              <X className="h-3 w-3" /> Clear colour
            </button>
          </>
        ) : null}
      </PopoverContent>
    </Popover>
  )
}
