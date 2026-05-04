'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Plus, Trash2, Upload, ShieldAlert, Search, Pencil } from 'lucide-react'
import { toast } from 'sonner'

interface RedFlagWord {
  id: string
  word: string
  category: string
  severity: string
  language: string
  reason: string
}

const CATEGORIES = [
  { key: 'ai', label: 'AI cliche' },
  { key: 'brand', label: 'Brand forbidden' },
  { key: 'compliance', label: 'Compliance' },
  { key: 'competitor', label: 'Competitor' },
  { key: 'other', label: 'Other' },
] as const

const SEVERITIES = [
  { key: 'warn', label: 'Warn' },
  { key: 'block', label: 'Block' },
] as const

const LANGUAGES = [
  { key: 'any', label: 'Any' },
  { key: 'uk', label: 'Ukrainian' },
  { key: 'en', label: 'English' },
  { key: 'ru', label: 'Russian' },
] as const

interface Props {
  initialWords: RedFlagWord[]
}

export function RedFlagsClient({ initialWords }: Props) {
  const router = useRouter()
  const [words, setWords] = useState<RedFlagWord[]>(initialWords)
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState<string>('all')

  // Add dialog
  const [addOpen, setAddOpen] = useState(false)
  const [form, setForm] = useState({ word: '', category: 'ai', severity: 'warn', language: 'any', reason: '' })
  const [saving, setSaving] = useState(false)

  // Bulk dialog
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkText, setBulkText] = useState('')
  const [bulkCategory, setBulkCategory] = useState('ai')
  const [bulkLanguage, setBulkLanguage] = useState('any')

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false)
  const [editForm, setEditForm] = useState<RedFlagWord | null>(null)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return words.filter((w) => {
      if (filterCategory !== 'all' && w.category !== filterCategory) return false
      if (q && !w.word.toLowerCase().includes(q) && !w.reason.toLowerCase().includes(q)) return false
      return true
    })
  }, [words, search, filterCategory])

  const grouped = useMemo(() => {
    const groups: Record<string, RedFlagWord[]> = {}
    for (const w of filtered) {
      if (!groups[w.category]) groups[w.category] = []
      groups[w.category].push(w)
    }
    return groups
  }, [filtered])

  const handleAdd = async () => {
    if (!form.word.trim()) {
      toast.error('Word is required')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/red-flags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data?.error ?? 'Could not add')
        return
      }
      toast.success('Red flag added')
      setWords((prev) => {
        const exists = prev.find((w) => w.id === data.word.id)
        return exists ? prev.map((w) => (w.id === data.word.id ? data.word : w)) : [...prev, data.word]
      })
      setForm({ word: '', category: 'ai', severity: 'warn', language: 'any', reason: '' })
      setAddOpen(false)
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  const handleBulkAdd = async () => {
    const lines = bulkText
      .split(/[\n,]+/)
      .map((l) => l.trim())
      .filter(Boolean)
    if (lines.length === 0) {
      toast.error('Nothing to add')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/red-flags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          words: lines.map((word) => ({ word, category: bulkCategory, language: bulkLanguage, severity: 'warn' })),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data?.error ?? 'Bulk add failed')
        return
      }
      toast.success(`Added ${data.created} words`)
      setWords((prev) => {
        const map = new Map(prev.map((w) => [w.id, w]))
        for (const w of data.words) map.set(w.id, w)
        return Array.from(map.values())
      })
      setBulkText('')
      setBulkOpen(false)
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this red flag word?')) return
    const res = await fetch(`/api/red-flags/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      toast.error('Could not delete')
      return
    }
    toast.success('Deleted')
    setWords((prev) => prev.filter((w) => w.id !== id))
    router.refresh()
  }

  const openEdit = (w: RedFlagWord) => {
    setEditForm(w)
    setEditOpen(true)
  }

  const handleEditSave = async () => {
    if (!editForm) return
    setSaving(true)
    try {
      const res = await fetch(`/api/red-flags/${editForm.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          word: editForm.word,
          category: editForm.category,
          severity: editForm.severity,
          language: editForm.language,
          reason: editForm.reason,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data?.error ?? 'Could not save')
        return
      }
      toast.success('Updated')
      setWords((prev) => prev.map((w) => (w.id === editForm.id ? data.word : w)))
      setEditOpen(false)
      setEditForm(null)
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex items-center gap-2 flex-1 max-w-md w-full">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search words…"
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
            {CATEGORIES.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Upload className="h-4 w-4" /> Bulk import
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Bulk import red flags</DialogTitle>
                <DialogDescription>
                  Paste one word/phrase per line (or comma-separated). All items will share the same category and language.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Category</Label>
                    <select
                      value={bulkCategory}
                      onChange={(e) => setBulkCategory(e.target.value)}
                      className="h-10 w-full px-3 text-sm bg-background border border-input"
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c.key} value={c.key}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label>Language</Label>
                    <select
                      value={bulkLanguage}
                      onChange={(e) => setBulkLanguage(e.target.value)}
                      className="h-10 w-full px-3 text-sm bg-background border border-input"
                    >
                      {LANGUAGES.map((l) => (
                        <option key={l.key} value={l.key}>
                          {l.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <Textarea
                  rows={8}
                  placeholder={'delve\nfurthermore\nin today\u2019s fast-paced world\nleverage'}
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setBulkOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleBulkAdd} loading={saving}>
                  Import
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4" /> Add word
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add red flag word</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="word">Word / phrase *</Label>
                  <Input
                    id="word"
                    value={form.word}
                    onChange={(e) => setForm((f) => ({ ...f, word: e.target.value }))}
                    placeholder='e.g. "delve"'
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Category</Label>
                    <select
                      value={form.category}
                      onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                      className="h-10 w-full px-3 text-sm bg-background border border-input"
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c.key} value={c.key}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label>Severity</Label>
                    <select
                      value={form.severity}
                      onChange={(e) => setForm((f) => ({ ...f, severity: e.target.value }))}
                      className="h-10 w-full px-3 text-sm bg-background border border-input"
                    >
                      {SEVERITIES.map((s) => (
                        <option key={s.key} value={s.key}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>Language</Label>
                  <select
                    value={form.language}
                    onChange={(e) => setForm((f) => ({ ...f, language: e.target.value }))}
                    className="h-10 w-full px-3 text-sm bg-background border border-input"
                  >
                    {LANGUAGES.map((l) => (
                      <option key={l.key} value={l.key}>
                        {l.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="reason">Reason (optional)</Label>
                  <Textarea
                    id="reason"
                    rows={2}
                    value={form.reason}
                    onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
                    placeholder="Why is this flagged?"
                  />
                </div>
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
            <ShieldAlert className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="mt-4 font-display font-semibold tracking-tight">No red flags yet</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Add words the AI should never use in generated content.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {Object.entries(grouped).map(([cat, list]) => {
            const meta = CATEGORIES.find((c) => c.key === cat)
            return (
              <div key={cat} className="bg-card border border-border shadow-sm">
                <div className="px-5 py-3 border-b border-border flex items-center justify-between">
                  <h4 className="font-display font-semibold tracking-tight text-sm">
                    {meta?.label ?? cat} <span className="text-muted-foreground">({list.length})</span>
                  </h4>
                </div>
                <div className="divide-y divide-border">
                  {list.map((w) => (
                    <div key={w.id} className="flex items-center gap-3 px-5 py-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-sm">{w.word}</span>
                          <Badge variant={w.severity === 'block' ? 'destructive' : 'secondary'} className="text-[10px]">
                            {w.severity}
                          </Badge>
                          {w.language !== 'any' ? (
                            <Badge variant="outline" className="text-[10px]">
                              {w.language}
                            </Badge>
                          ) : null}
                        </div>
                        {w.reason ? <p className="text-xs text-muted-foreground mt-0.5">{w.reason}</p> : null}
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => openEdit(w)} className="text-muted-foreground">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(w.id)} className="text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit red flag</DialogTitle>
          </DialogHeader>
          {editForm ? (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Word / phrase</Label>
                <Input
                  value={editForm.word}
                  onChange={(e) => setEditForm((f) => (f ? { ...f, word: e.target.value } : f))}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Category</Label>
                  <select
                    value={editForm.category}
                    onChange={(e) => setEditForm((f) => (f ? { ...f, category: e.target.value } : f))}
                    className="h-10 w-full px-3 text-sm bg-background border border-input"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c.key} value={c.key}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label>Severity</Label>
                  <select
                    value={editForm.severity}
                    onChange={(e) => setEditForm((f) => (f ? { ...f, severity: e.target.value } : f))}
                    className="h-10 w-full px-3 text-sm bg-background border border-input"
                  >
                    {SEVERITIES.map((s) => (
                      <option key={s.key} value={s.key}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-1">
                <Label>Language</Label>
                <select
                  value={editForm.language}
                  onChange={(e) => setEditForm((f) => (f ? { ...f, language: e.target.value } : f))}
                  className="h-10 w-full px-3 text-sm bg-background border border-input"
                >
                  {LANGUAGES.map((l) => (
                    <option key={l.key} value={l.key}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label>Reason</Label>
                <Textarea
                  rows={2}
                  value={editForm.reason}
                  onChange={(e) => setEditForm((f) => (f ? { ...f, reason: e.target.value } : f))}
                />
              </div>
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
