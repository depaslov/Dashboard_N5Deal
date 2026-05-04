'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Plus, Trash2, Link2, Search, Pencil, Star, Power, PowerOff, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface InternalLink {
  id: string
  url: string
  anchor: string
  anchorAlts: string[]
  context: string
  category: string
  priority: string
  isActive: boolean
}

const PRIORITIES = [
  { key: 'must', label: 'MUST insert' },
  { key: 'nice', label: 'Nice to have' },
] as const

interface Props {
  initialLinks: InternalLink[]
}

const emptyForm = (): InternalLink => ({
  id: '',
  url: '',
  anchor: '',
  anchorAlts: [],
  context: '',
  category: '',
  priority: 'nice',
  isActive: true,
})

export function InternalLinksClient({ initialLinks }: Props) {
  const router = useRouter()
  const [links, setLinks] = useState<InternalLink[]>(initialLinks)
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [filterPriority, setFilterPriority] = useState<string>('all')

  const [addOpen, setAddOpen] = useState(false)
  const [form, setForm] = useState<InternalLink>(emptyForm())
  const [altsInput, setAltsInput] = useState('')
  const [saving, setSaving] = useState(false)

  const [editOpen, setEditOpen] = useState(false)
  const [editForm, setEditForm] = useState<InternalLink | null>(null)
  const [editAltsInput, setEditAltsInput] = useState('')

  const categories = useMemo(() => {
    const set = new Set<string>()
    links.forEach((l) => {
      if (l.category) set.add(l.category)
    })
    return Array.from(set).sort()
  }, [links])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return links.filter((l) => {
      if (filterCategory !== 'all' && (l.category || '') !== filterCategory) return false
      if (filterPriority !== 'all' && l.priority !== filterPriority) return false
      if (
        q &&
        !l.url.toLowerCase().includes(q) &&
        !l.anchor.toLowerCase().includes(q) &&
        !l.context.toLowerCase().includes(q) &&
        !(l.anchorAlts || []).some((a) => a.toLowerCase().includes(q))
      ) {
        return false
      }
      return true
    })
  }, [links, search, filterCategory, filterPriority])

  const handleAdd = async () => {
    if (!form.url.trim() || !form.anchor.trim()) {
      toast.error('URL and anchor are required')
      return
    }
    setSaving(true)
    try {
      const payload = {
        ...form,
        anchorAlts: altsInput
          .split(/\n|,/)
          .map((s) => s.trim())
          .filter(Boolean),
      }
      const res = await fetch('/api/internal-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data?.error ?? 'Could not add')
        return
      }
      toast.success('Link added')
      setLinks((prev) => {
        const exists = prev.find((l) => l.id === data.link.id)
        return exists ? prev.map((l) => (l.id === data.link.id ? data.link : l)) : [...prev, data.link]
      })
      setForm(emptyForm())
      setAltsInput('')
      setAddOpen(false)
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this internal link?')) return
    const res = await fetch(`/api/internal-links/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      toast.error('Could not delete')
      return
    }
    toast.success('Deleted')
    setLinks((prev) => prev.filter((l) => l.id !== id))
    router.refresh()
  }

  const handleToggleActive = async (link: InternalLink) => {
    const res = await fetch(`/api/internal-links/${link.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !link.isActive }),
    })
    const data = await res.json()
    if (!res.ok) {
      toast.error(data?.error ?? 'Could not update')
      return
    }
    setLinks((prev) => prev.map((l) => (l.id === link.id ? { ...l, isActive: data.link.isActive } : l)))
    toast.success(data.link.isActive ? 'Activated' : 'Paused')
    router.refresh()
  }

  const openEdit = (link: InternalLink) => {
    setEditForm({ ...link })
    setEditAltsInput((link.anchorAlts || []).join('\n'))
    setEditOpen(true)
  }

  const handleEditSave = async () => {
    if (!editForm) return
    setSaving(true)
    try {
      const payload = {
        ...editForm,
        anchorAlts: editAltsInput
          .split(/\n|,/)
          .map((s) => s.trim())
          .filter(Boolean),
      }
      const res = await fetch(`/api/internal-links/${editForm.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data?.error ?? 'Could not save')
        return
      }
      toast.success('Updated')
      setLinks((prev) => prev.map((l) => (l.id === editForm.id ? data.link : l)))
      setEditOpen(false)
      setEditForm(null)
      setEditAltsInput('')
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex items-center gap-2 flex-1 max-w-lg w-full">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search links…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="h-10 px-3 text-sm bg-background border border-input"
          >
            <option value="all">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className="h-10 px-3 text-sm bg-background border border-input"
          >
            <option value="all">All priorities</option>
            {PRIORITIES.map((p) => (
              <option key={p.key} value={p.key}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4" /> Add link
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Add internal link</DialogTitle>
                <DialogDescription>
                  The AI will insert links from this library where they fit naturally.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="url">Destination URL *</Label>
                  <Input
                    id="url"
                    value={form.url}
                    onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
                    placeholder="/buyer  or  https://n5deal.com/buyer"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="anchor">Primary anchor text *</Label>
                  <Input
                    id="anchor"
                    value={form.anchor}
                    onChange={(e) => setForm((f) => ({ ...f, anchor: e.target.value }))}
                    placeholder="e.g. buy a business"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="anchorAlts">Anchor alternatives (one per line)</Label>
                  <Textarea
                    id="anchorAlts"
                    rows={3}
                    value={altsInput}
                    onChange={(e) => setAltsInput(e.target.value)}
                    placeholder={'acquire a licensed business\nacquisition-ready fintech assets'}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="category">Category</Label>
                    <Input
                      id="category"
                      value={form.category}
                      onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                      placeholder="product, blog, landing…"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Priority</Label>
                    <select
                      value={form.priority}
                      onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
                      className="h-10 w-full px-3 text-sm bg-background border border-input"
                    >
                      {PRIORITIES.map((p) => (
                        <option key={p.key} value={p.key}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="context">Context / insertion hint</Label>
                  <Textarea
                    id="context"
                    rows={2}
                    value={form.context}
                    onChange={(e) => setForm((f) => ({ ...f, context: e.target.value }))}
                    placeholder='e.g. When discussing how to purchase a licensed asset, insert this link.'
                  />
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={form.isActive}
                    onCheckedChange={(v) => setForm((f) => ({ ...f, isActive: Boolean(v) }))}
                  />
                  Active (available for new briefs)
                </label>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAddOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAdd} loading={saving}>
                  Add
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="bg-card border border-border shadow-sm p-10 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center bg-secondary">
            <Link2 className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="mt-4 font-display font-semibold tracking-tight">No internal links yet</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Add your key destination URLs so the AI can link to them automatically.
          </p>
        </div>
      ) : (
        <div className="bg-card border border-border shadow-sm">
          <div className="px-5 py-3 border-b border-border">
            <h4 className="font-display font-semibold tracking-tight text-sm">
              Links <span className="text-muted-foreground">({filtered.length})</span>
            </h4>
          </div>
          <div className="divide-y divide-border">
            {filtered.map((l) => (
              <div key={l.id} className={cn('px-5 py-4 space-y-1', !l.isActive && 'opacity-60')}>
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <code className="text-sm bg-secondary px-1.5 py-0.5">{l.url}</code>
                      {l.priority === 'must' ? (
                        <Badge variant="default" className="text-[10px] gap-0.5">
                          <Star className="h-2.5 w-2.5" /> MUST
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px]">
                          nice
                        </Badge>
                      )}
                      {l.category ? (
                        <Badge variant="secondary" className="text-[10px]">
                          {l.category}
                        </Badge>
                      ) : null}
                      {!l.isActive ? (
                        <Badge variant="destructive" className="text-[10px]">
                          Paused
                        </Badge>
                      ) : null}
                    </div>
                    <div className="text-sm">
                      <span className="text-muted-foreground">Anchor:</span> {l.anchor}
                    </div>
                    {l.anchorAlts?.length > 0 ? (
                      <div className="text-xs text-muted-foreground">
                        Alternatives: {l.anchorAlts.join(' • ')}
                      </div>
                    ) : null}
                    {l.context ? (
                      <p className="text-xs text-muted-foreground italic">{l.context}</p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggleActive(l)}
                      className="text-muted-foreground"
                      title={l.isActive ? 'Pause' : 'Activate'}
                    >
                      {l.isActive ? <Power className="h-4 w-4" /> : <PowerOff className="h-4 w-4" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEdit(l)}
                      className="text-muted-foreground"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(l.id)}
                      className="text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit internal link</DialogTitle>
          </DialogHeader>
          {editForm ? (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Destination URL</Label>
                <Input
                  value={editForm.url}
                  onChange={(e) => setEditForm((f) => (f ? { ...f, url: e.target.value } : f))}
                />
              </div>
              <div className="space-y-1">
                <Label>Primary anchor</Label>
                <Input
                  value={editForm.anchor}
                  onChange={(e) => setEditForm((f) => (f ? { ...f, anchor: e.target.value } : f))}
                />
              </div>
              <div className="space-y-1">
                <Label>Anchor alternatives (one per line)</Label>
                <Textarea
                  rows={3}
                  value={editAltsInput}
                  onChange={(e) => setEditAltsInput(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Category</Label>
                  <Input
                    value={editForm.category}
                    onChange={(e) => setEditForm((f) => (f ? { ...f, category: e.target.value } : f))}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Priority</Label>
                  <select
                    value={editForm.priority}
                    onChange={(e) => setEditForm((f) => (f ? { ...f, priority: e.target.value } : f))}
                    className="h-10 w-full px-3 text-sm bg-background border border-input"
                  >
                    {PRIORITIES.map((p) => (
                      <option key={p.key} value={p.key}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-1">
                <Label>Context</Label>
                <Textarea
                  rows={2}
                  value={editForm.context}
                  onChange={(e) => setEditForm((f) => (f ? { ...f, context: e.target.value } : f))}
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={editForm.isActive}
                  onCheckedChange={(v) => setEditForm((f) => (f ? { ...f, isActive: Boolean(v) } : f))}
                />
                Active
              </label>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditSave} loading={saving}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
