'use client'

import { cn } from '@/lib/utils'

// Stable-per-name colour so the same person always gets the same avatar
// background. Cheap hash → palette index; the palette is small enough to
// not require any seeding. Picked tailwind classes that have decent
// contrast on both light + dark backgrounds.
const AVATAR_PALETTE = [
  'bg-rose-500 text-white',
  'bg-amber-500 text-white',
  'bg-emerald-500 text-white',
  'bg-teal-500 text-white',
  'bg-sky-500 text-white',
  'bg-violet-500 text-white',
  'bg-fuchsia-500 text-white',
  'bg-orange-500 text-white',
]

function paletteFor(name: string): string {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length]
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export interface AssigneeLike {
  id: string
  name: string
  email?: string
}

interface Props {
  assigneeIds: string[]
  members: AssigneeLike[]
  size?: 'xs' | 'sm' | 'md'
  max?: number
  className?: string
}

// Stack of overlapping circular avatars rendered for a task's assignees.
// Caps at `max` and renders a "+N" pill for the overflow. Tooltip on each
// avatar shows the full name. Used on List rows, Calendar chips, Board
// cards — same component everywhere so the look is consistent.
export function AssigneeAvatars({
  assigneeIds,
  members,
  size = 'sm',
  max = 3,
  className,
}: Props) {
  if (assigneeIds.length === 0) return null

  const byId = new Map(members.map((m) => [m.id, m]))
  const present = assigneeIds
    .map((id) => byId.get(id))
    .filter((m): m is AssigneeLike => m != null)

  if (present.length === 0) return null

  const visible = present.slice(0, max)
  const overflow = present.length - visible.length

  const dim = {
    xs: 'h-4 w-4 text-[8px] -ml-1 first:ml-0 ring-1',
    sm: 'h-5 w-5 text-[9px] -ml-1.5 first:ml-0 ring-1',
    md: 'h-7 w-7 text-[11px] -ml-2 first:ml-0 ring-2',
  }[size]

  return (
    <div className={cn('inline-flex items-center', className)}>
      {visible.map((m) => (
        <span
          key={m.id}
          title={m.email ? `${m.name} · ${m.email}` : m.name}
          className={cn(
            'inline-flex items-center justify-center rounded-full font-semibold ring-background',
            dim,
            paletteFor(m.name),
          )}
        >
          {initialsOf(m.name)}
        </span>
      ))}
      {overflow > 0 ? (
        <span
          title={present.slice(max).map((m) => m.name).join(', ')}
          className={cn(
            'inline-flex items-center justify-center rounded-full font-semibold ring-background bg-muted text-foreground/70',
            dim,
          )}
        >
          +{overflow}
        </span>
      ) : null}
    </div>
  )
}

interface PickerProps {
  members: AssigneeLike[]
  value: string[]
  onChange: (next: string[]) => void
}

// Multi-select picker rendered in the form modal. Lists every project
// member; click to toggle. Currently-assigned members highlight + the
// avatar appears next to the row so the visual mapping with the cards is
// obvious. Keeps things keyboard-friendly with a focusable button per row.
export function AssigneePicker({ members, value, onChange }: PickerProps) {
  if (members.length === 0) {
    return (
      <p className="text-xs text-muted-foreground italic">
        No project members yet. Invite teammates in Settings → Members.
      </p>
    )
  }
  function toggle(id: string) {
    onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id])
  }
  return (
    <div className="border border-border rounded-md divide-y divide-border max-h-44 overflow-y-auto">
      {members.map((m) => {
        const on = value.includes(m.id)
        return (
          <button
            key={m.id}
            type="button"
            onClick={() => toggle(m.id)}
            className={cn(
              'w-full flex items-center gap-2 px-2.5 py-1.5 text-left text-sm transition-colors',
              on ? 'bg-primary/10 text-foreground' : 'hover:bg-accent/40',
            )}
          >
            <span
              className={cn(
                'inline-flex items-center justify-center rounded-full font-semibold h-6 w-6 text-[10px]',
                paletteFor(m.name),
              )}
            >
              {initialsOf(m.name)}
            </span>
            <span className="min-w-0 flex-1 truncate">
              <span className="font-medium">{m.name}</span>
              {m.email ? <span className="text-muted-foreground ml-1.5 text-xs">{m.email}</span> : null}
            </span>
            <span
              className={cn(
                'inline-flex h-4 w-4 items-center justify-center rounded border text-[10px]',
                on ? 'bg-primary border-primary text-primary-foreground' : 'border-border text-transparent',
              )}
              aria-hidden
            >
              ✓
            </span>
          </button>
        )
      })}
    </div>
  )
}
