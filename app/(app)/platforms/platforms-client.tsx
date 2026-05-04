'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Plus, Pencil, Trash2, Power, PowerOff } from 'lucide-react'
import { toast } from 'sonner'

interface Platform {
  id: string
  name: string
  slug: string
  formatType: string
  minLength: number | null
  maxLength: number | null
  lengthUnit: string
  tone: string | null
  hashtagRules: string | null
  disclaimers: string | null
  promptFragment: string | null
  isActive: boolean
}

interface Props {
  initialPlatforms: Platform[]
}

const FORMAT_TYPES = [
  { value: 'article',          label: 'Article (long-form)' },
  { value: 'newsletter',       label: 'Newsletter' },
  { value: 'post',             label: 'Post (short)' },
  { value: 'thread',           label: 'Thread' },
  { value: 'video-description',label: 'Video description' },
  { value: 'other',            label: 'Other' },
]

function emptyForm(): Platform {
  return {
    id: '', name: '', slug: '', formatType: 'post',
    minLength: null, maxLength: null, lengthUnit: 'chars',
    tone: '', hashtagRules: '', disclaimers: '', promptFragment: '',
    isActive: true,
  } as Platform
}

function PlatformDialog({
  open, onOpenChange, mode, initial, onSave, saving,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  mode: 'create' | 'edit'
  initial: Platform
  onSave: (form: Platform) => void
  saving: boolean
}) {
  const [form, setForm] = useState<Platform>(initial)
  // Re-init form when the dialog opens on a (potentially different) row.
  useEffect(() => {
    if (open) setForm(initial)
  }, [open, initial])

  const update = <K extends keyof Platform>(k: K, v: Platform[K]) =>
    setForm((f) => ({ ...f, [k]: v }))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'New platform' : `Edit ${initial.name}`}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <Label>Name *</Label>
              <Input value={form.name} maxLength={80} placeholder="Medium"
                onChange={(e) => update('name', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Slug</Label>
              <Input value={form.slug} placeholder="auto-generated from name if empty"
                onChange={(e) => update('slug', e.target.value)} />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-1">
              <Label>Format type *</Label>
              <select
                className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm h-10"
                value={form.formatType}
                onChange={(e) => update('formatType', e.target.value)}
              >
                {FORMAT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Min length</Label>
              <Input type="number" min={0} value={form.minLength ?? ''}
                onChange={(e) => update('minLength', e.target.value === '' ? null : Number(e.target.value))} />
            </div>
            <div className="space-y-1">
              <Label>Max length</Label>
              <Input type="number" min={0} value={form.maxLength ?? ''}
                onChange={(e) => update('maxLength', e.target.value === '' ? null : Number(e.target.value))} />
            </div>
          </div>

          <div className="space-y-1">
            <Label>Length unit</Label>
            <div className="flex gap-2">
              {(['chars', 'words'] as const).map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => update('lengthUnit', u)}
                  className={`px-3 py-1 text-sm border ${form.lengthUnit === u ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border'}`}
                >
                  {u}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <Label>Tone</Label>
            <Textarea rows={2} value={form.tone ?? ''}
              placeholder="e.g. Professional, conversational. Avoid hype."
              onChange={(e) => update('tone', e.target.value)} />
          </div>

          <div className="space-y-1">
            <Label>Hashtag rules</Label>
            <Textarea rows={2} value={form.hashtagRules ?? ''}
              placeholder="e.g. Max 3 hashtags. No #invest, #trading."
              onChange={(e) => update('hashtagRules', e.target.value)} />
          </div>

          <div className="space-y-1">
            <Label>Disclaimers</Label>
            <Textarea rows={2} value={form.disclaimers ?? ''}
              placeholder="Required disclaimer text for posts on this platform."
              onChange={(e) => update('disclaimers', e.target.value)} />
          </div>

          <div className="space-y-1">
            <Label>Prompt fragment</Label>
            <Textarea rows={4} value={form.promptFragment ?? ''}
              placeholder="Platform-specific instructions appended to the LLM prompt when this platform is selected."
              onChange={(e) => update('promptFragment', e.target.value)} />
          </div>

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={form.isActive}
              onChange={(e) => update('isActive', e.target.checked)} />
            Active (available for selection in Content Studio)
          </label>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => onSave(form)} disabled={saving}>
            {saving ? 'Saving…' : mode === 'create' ? 'Create' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function PlatformsClient({ initialPlatforms }: Props) {
  const router = useRouter()
  const [platforms, setPlatforms] = useState<Platform[]>(initialPlatforms)
  const [addOpen, setAddOpen] = useState(false)
  const [editing, setEditing] = useState<Platform | null>(null)
  const [saving, setSaving] = useState(false)

  const handleCreate = async (form: Platform) => {
    if (!form.name.trim()) { toast.error('Name is required'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/platforms', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data?.error ?? 'Could not create'); return }
      setPlatforms((prev) => [...prev, data.platform].sort((a, b) => a.name.localeCompare(b.name)))
      toast.success('Platform created')
      setAddOpen(false)
      router.refresh()
    } finally { setSaving(false) }
  }

  const handleEdit = async (form: Platform) => {
    if (!form.name.trim()) { toast.error('Name is required'); return }
    setSaving(true)
    try {
      const res = await fetch(`/api/platforms/${form.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data?.error ?? 'Could not update'); return }
      setPlatforms((prev) =>
        prev.map((p) => (p.id === form.id ? data.platform : p)).sort((a, b) => a.name.localeCompare(b.name)),
      )
      toast.success('Platform updated')
      setEditing(null)
      router.refresh()
    } finally { setSaving(false) }
  }

  const handleDelete = async (p: Platform) => {
    if (!confirm(`Delete "${p.name}"? This cannot be undone.`)) return
    const res = await fetch(`/api/platforms/${p.id}`, { method: 'DELETE' })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      toast.error(data?.error ?? 'Could not delete')
      return
    }
    setPlatforms((prev) => prev.filter((x) => x.id !== p.id))
    toast.success('Platform deleted')
    router.refresh()
  }

  const toggleActive = async (p: Platform) => {
    const res = await fetch(`/api/platforms/${p.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !p.isActive }),
    })
    const data = await res.json()
    if (!res.ok) { toast.error(data?.error ?? 'Could not update'); return }
    setPlatforms((prev) => prev.map((x) => (x.id === p.id ? data.platform : x)))
    router.refresh()
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" /> New platform</Button>
          </DialogTrigger>
          <PlatformDialog
            open={addOpen}
            onOpenChange={setAddOpen}
            mode="create"
            initial={emptyForm()}
            onSave={handleCreate}
            saving={saving}
          />
        </Dialog>
      </div>

      {platforms.length === 0 ? (
        <div className="bg-card border border-border p-8 text-center text-muted-foreground">
          No platforms yet. Add Medium, LinkedIn, Reddit, etc. — each with its own format and tone.
        </div>
      ) : (
        <div className="bg-card border border-border divide-y divide-border">
          {platforms.map((p) => (
            <div key={p.id} className={`flex items-start gap-4 px-4 py-3 ${p.isActive ? '' : 'opacity-60'}`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <p className="font-medium truncate">{p.name}</p>
                  <code className="text-[11px] text-muted-foreground">{p.slug}</code>
                  <span className="text-[11px] px-1.5 py-0.5 bg-secondary rounded-sm">{p.formatType}</span>
                  {!p.isActive && <span className="text-[11px] text-muted-foreground">(inactive)</span>}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {p.minLength !== null || p.maxLength !== null ? (
                    <>Length: {p.minLength ?? '—'}–{p.maxLength ?? '—'} {p.lengthUnit}</>
                  ) : 'No length limits'}
                  {p.tone ? ` · Tone: ${p.tone.slice(0, 60)}${p.tone.length > 60 ? '…' : ''}` : ''}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => toggleActive(p)} title={p.isActive ? 'Deactivate' : 'Activate'}>
                {p.isActive ? <Power className="h-3.5 w-3.5" /> : <PowerOff className="h-3.5 w-3.5" />}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setEditing(p)}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => handleDelete(p)} className="text-destructive hover:text-destructive">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <PlatformDialog
          open={!!editing}
          onOpenChange={(o) => !o && setEditing(null)}
          mode="edit"
          initial={editing}
          onSave={handleEdit}
          saving={saving}
        />
      )}
    </div>
  )
}
