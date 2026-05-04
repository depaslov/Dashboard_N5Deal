'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

interface TagRow {
  id: string
  name: string
  color: string | null
  icpCount: number
}

interface Props {
  initialTags: TagRow[]
}

const DEFAULT_COLOR = '#64748b'

const PRESET_COLORS = [
  '#1f6feb', '#10b981', '#f59e0b', '#ef4444', '#a855f7',
  '#06b6d4', '#ec4899', '#64748b', '#84cc16', '#f97316',
]

function ColorSwatch({ color }: { color: string | null }) {
  return (
    <span
      className="inline-block h-3 w-3 rounded-full border border-border"
      style={{ backgroundColor: color ?? 'transparent' }}
    />
  )
}

export function TagsClient({ initialTags }: Props) {
  const router = useRouter()
  const [tags, setTags] = useState<TagRow[]>(initialTags)
  const [addOpen, setAddOpen] = useState(false)
  const [name, setName] = useState('')
  const [color, setColor] = useState<string>(DEFAULT_COLOR)
  const [saving, setSaving] = useState(false)

  const [editing, setEditing] = useState<TagRow | null>(null)
  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState<string>(DEFAULT_COLOR)

  const resetAdd = () => {
    setName('')
    setColor(DEFAULT_COLOR)
  }

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error('Name is required')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), color }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data?.error ?? 'Could not create tag')
        return
      }
      setTags((prev) =>
        [...prev, { id: data.tag.id, name: data.tag.name, color: data.tag.color, icpCount: 0 }].sort((a, b) =>
          a.name.localeCompare(b.name),
        ),
      )
      toast.success('Tag created')
      setAddOpen(false)
      resetAdd()
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  const openEdit = (t: TagRow) => {
    setEditing(t)
    setEditName(t.name)
    setEditColor(t.color ?? DEFAULT_COLOR)
  }

  const handleSaveEdit = async () => {
    if (!editing) return
    if (!editName.trim()) {
      toast.error('Name is required')
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/tags/${editing.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName.trim(), color: editColor }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data?.error ?? 'Could not update tag')
        return
      }
      setTags((prev) =>
        prev
          .map((t) => (t.id === editing.id ? { ...t, name: data.tag.name, color: data.tag.color } : t))
          .sort((a, b) => a.name.localeCompare(b.name)),
      )
      toast.success('Tag updated')
      setEditing(null)
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (t: TagRow) => {
    const msg = t.icpCount > 0
      ? `Delete tag "${t.name}"? It is currently applied to ${t.icpCount} ICP(s). Links will be removed.`
      : `Delete tag "${t.name}"?`
    if (!confirm(msg)) return
    const res = await fetch(`/api/tags/${t.id}`, { method: 'DELETE' })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      toast.error(data?.error ?? 'Could not delete tag')
      return
    }
    setTags((prev) => prev.filter((x) => x.id !== t.id))
    toast.success('Tag deleted')
    router.refresh()
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={addOpen} onOpenChange={(o) => { setAddOpen(o); if (!o) resetAdd() }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" /> New tag
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create tag</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="tag-name">Name</Label>
                <Input
                  id="tag-name"
                  value={name}
                  maxLength={50}
                  placeholder="e.g. fintech"
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Color</Label>
                <div className="flex flex-wrap gap-2">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={`h-7 w-7 rounded-full border-2 ${color === c ? 'border-foreground' : 'border-transparent'}`}
                      style={{ backgroundColor: c }}
                      aria-label={c}
                    />
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={saving}>
                {saving ? 'Creating…' : 'Create'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {tags.length === 0 ? (
        <div className="bg-card border border-border p-8 text-center text-muted-foreground">
          No tags yet. Create your first tag to start labeling ICPs.
        </div>
      ) : (
        <div className="bg-card border border-border divide-y divide-border">
          {tags.map((t) => (
            <div key={t.id} className="flex items-center gap-3 px-4 py-3">
              <ColorSwatch color={t.color} />
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{t.name}</p>
                <p className="text-xs text-muted-foreground">
                  {t.icpCount} ICP{t.icpCount === 1 ? '' : 's'}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => openEdit(t)}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDelete(t)}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit tag</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-tag-name">Name</Label>
              <Input
                id="edit-tag-name"
                value={editName}
                maxLength={50}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex flex-wrap gap-2">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setEditColor(c)}
                    className={`h-7 w-7 rounded-full border-2 ${editColor === c ? 'border-foreground' : 'border-transparent'}`}
                    style={{ backgroundColor: c }}
                    aria-label={c}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={handleSaveEdit} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
