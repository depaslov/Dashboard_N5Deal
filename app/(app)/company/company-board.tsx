'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Plus, Trash2, ChevronUp, ChevronDown, Edit, Save, X, Eye, Database,
  Search, FileText, Building, Users, Package, BarChart3, Link as LinkIcon,
  Newspaper, History, Heart, Sparkles, Lightbulb, Loader2, ExternalLink,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { renderMarkdown } from '@/lib/markdown'
import { cn } from '@/lib/utils'

export interface CompanySection {
  id: string
  title: string
  type: string
  content: string
  sortOrder: number
  isPublished: boolean
  source: string
  sourcePath: string | null
  updatedAt: string
}

const TYPES = [
  { k: 'about',     label: 'About',     icon: Building },
  { k: 'mission',   label: 'Mission',   icon: Heart },
  { k: 'values',    label: 'Values',    icon: Sparkles },
  { k: 'team',      label: 'Team',      icon: Users },
  { k: 'products',  label: 'Products',  icon: Package },
  { k: 'facts',     label: 'Key facts', icon: BarChart3 },
  { k: 'links',     label: 'Links',     icon: LinkIcon },
  { k: 'press',     label: 'Press',     icon: Newspaper },
  { k: 'timeline',  label: 'Timeline',  icon: History },
  { k: 'other',     label: 'Other',     icon: FileText },
] as const

const TYPE_BADGE: Record<string, string> = {
  about: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  mission: 'bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-300',
  values: 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300',
  team: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  products: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  facts: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  links: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300',
  press: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300',
  timeline: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300',
  other: 'bg-muted text-muted-foreground',
}

function typeMeta(type: string) {
  return TYPES.find((t) => t.k === type) ?? TYPES[TYPES.length - 1]
}

type Mode =
  | { kind: 'create' }
  | { kind: 'edit'; section: CompanySection }
  | { kind: 'myvault' }
  | null

export function CompanyBoard({
  initial,
  hasObsidianContent,
}: {
  initial: CompanySection[]
  hasObsidianContent: boolean
}) {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>(null)
  const [filter, setFilter] = useState<string>('all')

  const visible = useMemo(() => {
    if (filter === 'all') return initial
    return initial.filter((s) => s.type === filter)
  }, [initial, filter])

  async function reorder(id: string, dir: -1 | 1) {
    const idx = initial.findIndex((s) => s.id === id)
    if (idx < 0) return
    const swapIdx = idx + dir
    if (swapIdx < 0 || swapIdx >= initial.length) return
    const a = initial[idx]
    const b = initial[swapIdx]
    // Swap sortOrder values via two PATCHes
    await Promise.all([
      fetch(`/api/company-info/${a.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sortOrder: b.sortOrder }),
      }),
      fetch(`/api/company-info/${b.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sortOrder: a.sortOrder }),
      }),
    ])
    router.refresh()
  }

  async function remove(id: string) {
    if (!confirm('Delete this section?')) return
    const res = await fetch(`/api/company-info/${id}`, { method: 'DELETE' })
    if (!res.ok) { toast.error('Delete failed'); return }
    toast.success('Deleted')
    router.refresh()
  }

  async function togglePublish(s: CompanySection) {
    await fetch(`/api/company-info/${s.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isPublished: !s.isPublished }),
    })
    router.refresh()
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="h-9 w-[160px]"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {TYPES.map((t) => <SelectItem key={t.k} value={t.k}>{t.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="text-xs text-muted-foreground">
          {initial.length} section{initial.length !== 1 ? 's' : ''} · {initial.filter((s) => s.isPublished).length} published
        </div>

        <div className="ml-auto flex items-center gap-2">
          {hasObsidianContent ? (
            <Button variant="outline" onClick={() => setMode({ kind: 'myvault' })} className="gap-1.5">
              <Database className="h-3.5 w-3.5" /> Import from MyVault
            </Button>
          ) : null}
          <Button onClick={() => setMode({ kind: 'create' })}>
            <Plus className="h-4 w-4 mr-1.5" /> Add section
          </Button>
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          hasObsidian={hasObsidianContent}
          onAdd={() => setMode({ kind: 'create' })}
          onVault={() => setMode({ kind: 'myvault' })}
          isFiltered={filter !== 'all'}
        />
      ) : (
        <div className="space-y-3">
          {visible.map((s, idx) => (
            <SectionCard
              key={s.id}
              section={s}
              isFirst={idx === 0 && filter === 'all'}
              isLast={idx === visible.length - 1 && filter === 'all'}
              onEdit={() => setMode({ kind: 'edit', section: s })}
              onUp={() => reorder(s.id, -1)}
              onDown={() => reorder(s.id, 1)}
              onRemove={() => remove(s.id)}
              onTogglePublish={() => togglePublish(s)}
            />
          ))}
        </div>
      )}

      <SectionFormModal mode={mode} onClose={() => setMode(null)} />
      <MyVaultDialog
        open={mode?.kind === 'myvault'}
        onClose={() => setMode(null)}
        existingPaths={new Set(initial.filter((s) => s.sourcePath).map((s) => s.sourcePath!))}
      />
    </div>
  )
}

function SectionCard({
  section,
  isFirst,
  isLast,
  onEdit,
  onUp,
  onDown,
  onRemove,
  onTogglePublish,
}: {
  section: CompanySection
  isFirst: boolean
  isLast: boolean
  onEdit: () => void
  onUp: () => void
  onDown: () => void
  onRemove: () => void
  onTogglePublish: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const meta = typeMeta(section.type)
  const Icon = meta.icon
  return (
    <article className="bg-card border border-border rounded-lg shadow-sm">
      <header className="flex items-start gap-3 px-5 py-4 border-b border-border">
        <div className={cn('flex h-9 w-9 items-center justify-center rounded shrink-0', TYPE_BADGE[section.type] ?? TYPE_BADGE.other)}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-display font-semibold tracking-tight truncate">{section.title}</h3>
            <Badge variant="secondary" className={cn('text-[10px]', TYPE_BADGE[section.type] ?? TYPE_BADGE.other)}>
              {meta.label}
            </Badge>
            {section.source === 'obsidian' ? (
              <Badge variant="outline" className="text-[10px] gap-1">
                <Database className="h-2.5 w-2.5" /> MyVault
              </Badge>
            ) : null}
            {section.isPublished ? (
              <Badge variant="outline" className="text-[10px] text-emerald-700 border-emerald-200 dark:text-emerald-300 dark:border-emerald-900">
                Published
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] text-muted-foreground">Draft</Badge>
            )}
          </div>
          {section.sourcePath ? (
            <p className="text-[10px] text-muted-foreground mt-1 font-mono truncate" title={section.sourcePath}>
              {section.sourcePath}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button variant="ghost" size="icon" onClick={onUp} disabled={isFirst} className="h-7 w-7" aria-label="Move up">
            <ChevronUp className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onDown} disabled={isLast} className="h-7 w-7" aria-label="Move down">
            <ChevronDown className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setExpanded((v) => !v)} className="h-7 w-7" aria-label="Toggle preview">
            <Eye className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onEdit} className="h-7 w-7" aria-label="Edit">
            <Edit className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onRemove} className="h-7 w-7 text-muted-foreground hover:text-destructive" aria-label="Delete">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {expanded ? (
        <div className="px-5 py-4">
          {section.content.trim() ? (
            <article
              className="markdown-output text-sm"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(section.content) }}
            />
          ) : (
            <p className="text-xs text-muted-foreground italic">Empty section. Click Edit to add content.</p>
          )}
          <div className="mt-4 pt-3 border-t border-border flex items-center justify-between gap-3 text-xs text-muted-foreground">
            <span>{section.content.length.toLocaleString()} chars · updated {new Date(section.updatedAt).toLocaleDateString()}</span>
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <span>Published</span>
              <Switch checked={section.isPublished} onCheckedChange={onTogglePublish} />
            </label>
          </div>
        </div>
      ) : null}
    </article>
  )
}

function EmptyState({
  hasObsidian,
  onAdd,
  onVault,
  isFiltered,
}: { hasObsidian: boolean; onAdd: () => void; onVault: () => void; isFiltered: boolean }) {
  if (isFiltered) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card py-12 text-center text-sm text-muted-foreground">
        No sections in this category yet.
      </div>
    )
  }
  return (
    <div className="rounded-lg border border-dashed border-border bg-card py-16 px-6 text-center">
      <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 mb-4">
        <Building className="h-6 w-6 text-primary" />
      </div>
      <h3 className="font-semibold">Start your company workspace</h3>
      <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
        Add company info from scratch (About, Mission, Team, Products, Press…){' '}
        {hasObsidian ? (<>or pull existing material straight from MyVault.</>) : (<>— sections support full Markdown.</>)}
      </p>
      <div className="mt-5 flex items-center justify-center gap-2 flex-wrap">
        {hasObsidian ? (
          <Button variant="outline" onClick={onVault} className="gap-1.5">
            <Database className="h-3.5 w-3.5" /> Import from MyVault
          </Button>
        ) : null}
        <Button onClick={onAdd}>
          <Plus className="h-4 w-4 mr-1.5" /> Add first section
        </Button>
      </div>
    </div>
  )
}

// =============================================================================
// Section form modal — create / edit
// =============================================================================
function SectionFormModal({ mode, onClose }: { mode: Mode; onClose: () => void }) {
  const router = useRouter()
  const isOpen = mode?.kind === 'create' || mode?.kind === 'edit'
  const isEdit = mode?.kind === 'edit'
  const initial = isEdit ? mode.section : null

  const [title, setTitle] = useState('')
  const [type, setType] = useState<string>('about')
  const [content, setContent] = useState('')
  const [isPublished, setIsPublished] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    if (initial) {
      setTitle(initial.title); setType(initial.type); setContent(initial.content); setIsPublished(initial.isPublished)
    } else {
      setTitle(''); setType('about'); setContent(''); setIsPublished(false)
    }
    setShowPreview(false)
  }, [isOpen, initial])

  async function save() {
    if (!title.trim()) { toast.error('Title is required'); return }
    setSaving(true)
    try {
      const body = { title: title.trim(), type, content, isPublished }
      const url = isEdit ? `/api/company-info/${initial!.id}` : '/api/company-info'
      const method = isEdit ? 'PATCH' : 'POST'
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(data?.error ?? 'Save failed'); return }
      toast.success(isEdit ? 'Updated' : 'Section added')
      router.refresh(); onClose()
    } finally { setSaving(false) }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit section' : 'New section'}</DialogTitle>
          <DialogDescription>Markdown is supported. Toggle preview to see the rendered output.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-[1fr_180px] gap-3">
            <div>
              <Label htmlFor="ci-title">Title <span className="text-destructive">*</span></Label>
              <Input id="ci-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. About N5Deal" />
            </div>
            <div>
              <Label htmlFor="ci-type">Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger id="ci-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TYPES.map((t) => <SelectItem key={t.k} value={t.k}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <Label htmlFor="ci-content">Content <span className="text-muted-foreground font-normal text-[10px]">(Markdown)</span></Label>
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowPreview((v) => !v)} className="gap-1.5 h-7">
                <Eye className="h-3.5 w-3.5" /> {showPreview ? 'Hide preview' : 'Show preview'}
              </Button>
            </div>
            <div className={cn('grid gap-3', showPreview ? 'lg:grid-cols-2' : '')}>
              <Textarea
                id="ci-content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={14}
                placeholder="Write company info here — Markdown supported (headings, lists, bold, links)..."
                className="font-mono text-xs"
              />
              {showPreview ? (
                <article
                  className="markdown-output min-h-[18rem] p-3 border border-border rounded-md bg-background overflow-y-auto text-sm"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
                />
              ) : null}
            </div>
          </div>

          <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
            <Switch checked={isPublished} onCheckedChange={setIsPublished} />
            <span>Mark as published</span>
            <span className="text-xs text-muted-foreground">— ready for public use / handoff</span>
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            <X className="h-3.5 w-3.5 mr-1.5" /> Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Add section'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// =============================================================================
// MyVault import dialog
// =============================================================================
interface VaultFile {
  key: string
  title: string
  preview: string
  chunkCount: number
  fullChars: number
}

function MyVaultDialog({
  open,
  onClose,
  existingPaths,
}: {
  open: boolean
  onClose: () => void
  existingPaths: Set<string>
}) {
  const router = useRouter()
  const [files, setFiles] = useState<VaultFile[]>([])
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState('')
  const [importingKey, setImportingKey] = useState<string | null>(null)
  const [defaultType, setDefaultType] = useState<string>('about')

  useEffect(() => {
    if (!open) return
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const res = await fetch('/api/company-info/myvault')
        const data = await res.json()
        if (!cancelled) setFiles(data.files ?? [])
      } catch {
        if (!cancelled) toast.error('Could not load MyVault')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [open])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return files
    return files.filter((f) =>
      f.key.toLowerCase().includes(q) ||
      f.title.toLowerCase().includes(q) ||
      f.preview.toLowerCase().includes(q),
    )
  }, [files, query])

  async function importFile(f: VaultFile) {
    setImportingKey(f.key)
    try {
      const res = await fetch('/api/company-info/myvault/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: f.key, type: defaultType, title: f.title }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(data?.error ?? 'Import failed'); return }
      toast.success(`Imported "${f.title}"`)
      router.refresh()
    } finally { setImportingKey(null) }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Database className="h-4 w-4" /> Import from MyVault
          </DialogTitle>
          <DialogDescription>
            Files indexed from your Obsidian vault into RAG. Click any file to create a new
            company-info section seeded with its full content. Already-imported files are
            marked so you don't accidentally duplicate.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 mb-3">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by filename, title, or text..."
              className="h-9 pl-8"
            />
          </div>
          <Select value={defaultType} onValueChange={setDefaultType}>
            <SelectTrigger className="h-9 w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {TYPES.map((t) => <SelectItem key={t.k} value={t.k}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="border border-border rounded-lg bg-background max-h-[60vh] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Loading vault…
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              {files.length === 0 ? 'No files indexed in MyVault.' : 'No files match.'}
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {filtered.map((f) => {
                const already = existingPaths.has(f.key)
                const isImporting = importingKey === f.key
                return (
                  <li key={f.key} className="flex items-start gap-3 px-4 py-3">
                    <FileText className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-sm truncate">{f.title}</p>
                        <Badge variant="outline" className="text-[10px] tabular-nums">{f.chunkCount} chunks</Badge>
                        <Badge variant="outline" className="text-[10px] tabular-nums">{f.fullChars.toLocaleString()} chars</Badge>
                        {already ? (
                          <Badge variant="secondary" className="text-[10px] text-emerald-700 dark:text-emerald-300">
                            already imported
                          </Badge>
                        ) : null}
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5 font-mono truncate" title={f.key}>{f.key}</p>
                      <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{f.preview}</p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => importFile(f)}
                      disabled={isImporting}
                      className="gap-1.5 shrink-0"
                    >
                      {isImporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Lightbulb className="h-3.5 w-3.5" />}
                      {isImporting ? 'Importing…' : already ? 'Import again' : 'Import'}
                    </Button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
