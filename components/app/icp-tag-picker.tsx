'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Check, Plus, X } from 'lucide-react'
import { toast } from 'sonner'

interface TagItem {
  id: string
  name: string
  color: string | null
}

interface Props {
  icpId: string
  initialAssigned: TagItem[]
  initialAvailable: TagItem[] // all project tags
}

function TagChip({
  tag,
  onRemove,
}: {
  tag: TagItem
  onRemove?: () => void
}) {
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs border border-border bg-card"
      style={tag.color ? { borderColor: tag.color } : undefined}
    >
      <span
        className="inline-block h-2 w-2 rounded-full"
        style={{ backgroundColor: tag.color ?? '#94a3b8' }}
      />
      {tag.name}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="text-muted-foreground hover:text-foreground"
          aria-label={`Remove ${tag.name}`}
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </span>
  )
}

export function IcpTagPicker({ icpId, initialAssigned, initialAvailable }: Props) {
  const [assigned, setAssigned] = useState<TagItem[]>(initialAssigned)
  const [available] = useState<TagItem[]>(initialAvailable)
  const [open, setOpen] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const assignedIds = useMemo(() => new Set(assigned.map((t) => t.id)), [assigned])
  const unassigned = useMemo(
    () => available.filter((t) => !assignedIds.has(t.id)),
    [available, assignedIds],
  )

  const link = async (tag: TagItem) => {
    setBusyId(tag.id)
    try {
      const res = await fetch(`/api/icps/${icpId}/tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tagId: tag.id }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data?.error ?? 'Could not link tag')
        return
      }
      setAssigned((prev) => [...prev, tag].sort((a, b) => a.name.localeCompare(b.name)))
    } finally {
      setBusyId(null)
    }
  }

  const unlink = async (tag: TagItem) => {
    setBusyId(tag.id)
    try {
      const res = await fetch(`/api/icps/${icpId}/tags/${tag.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data?.error ?? 'Could not remove tag')
        return
      }
      setAssigned((prev) => prev.filter((t) => t.id !== tag.id))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="bg-card border border-border shadow-sm p-6 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display font-semibold">Tags</h3>
          <p className="text-xs text-muted-foreground">
            Project-scoped labels. Manage tags in <a href="/tags" className="underline">Tags</a>.
          </p>
        </div>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" disabled={available.length === 0}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Add tag
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-64 p-1">
            {available.length === 0 ? (
              <p className="px-2 py-3 text-sm text-muted-foreground">
                No tags in this project yet.
              </p>
            ) : unassigned.length === 0 ? (
              <p className="px-2 py-3 text-sm text-muted-foreground">All tags are already applied.</p>
            ) : (
              <div className="max-h-64 overflow-y-auto">
                {unassigned.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => link(t)}
                    disabled={busyId === t.id}
                    className="w-full flex items-center gap-2 px-2 py-1.5 text-left text-sm hover:bg-secondary disabled:opacity-50"
                  >
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: t.color ?? '#94a3b8' }}
                    />
                    <span className="flex-1 truncate">{t.name}</span>
                    {busyId === t.id && <Check className="h-3 w-3 opacity-50" />}
                  </button>
                ))}
              </div>
            )}
          </PopoverContent>
        </Popover>
      </div>

      {assigned.length === 0 ? (
        <p className="text-sm text-muted-foreground">No tags applied to this ICP.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {assigned.map((t) => (
            <TagChip key={t.id} tag={t} onRemove={() => unlink(t)} />
          ))}
        </div>
      )}
    </div>
  )
}
