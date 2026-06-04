'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Search, Sparkles, FileText, BookOpen, Linkedin, Send, Clock, Trash2, Files,
  Folder, FolderPlus, FolderOpen, Inbox, Pencil, Check, X, FolderInput, Loader2,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { AnnotationStatusDot } from './color-tag-dot'

const TYPES: Record<string, { label: string; icon: any }> = {
  article: { label: 'Article', icon: FileText },
  catalog: { label: 'Catalog', icon: BookOpen },
  linkedin: { label: 'LinkedIn', icon: Linkedin },
  telegram: { label: 'Telegram', icon: Send },
}

interface Item {
  id: string
  contentType: string
  topic: string
  targetAudience: string
  tone: string
  createdAt: string
  createdByName: string
  folderId: string | null
}

interface FolderRow {
  id: string
  name: string
  color: string | null
  count: number
}

// Special filter sentinels (not real folder ids)
const ALL = '__all__'
const UNFILED = '__unfiled__'

export function ContentListClient({ items, folders: initialFolders }: { items: Item[]; folders: FolderRow[] }) {
  const [query, setQuery] = useState('')
  const [type, setType] = useState<string>('all')
  const [activeFolder, setActiveFolder] = useState<string>(ALL)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null)
  const [folders, setFolders] = useState<FolderRow[]>(initialFolders)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [movingId, setMovingId] = useState<string | null>(null)
  const router = useRouter()

  const unfiledCount = useMemo(() => items.filter((i) => !i.folderId).length, [items])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (items ?? []).filter((i) => {
      if (activeFolder === UNFILED && i.folderId) return false
      if (activeFolder !== ALL && activeFolder !== UNFILED && i.folderId !== activeFolder) return false
      if (type !== 'all' && i?.contentType !== type) return false
      if (!q) return true
      return [i?.topic, i?.targetAudience, i?.tone].filter(Boolean).join(' ').toLowerCase().includes(q)
    })
  }, [items, query, type, activeFolder])

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this brief?')) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/content/${id}`, { method: 'DELETE' })
      if (!res.ok) { toast.error('Could not delete'); return }
      toast.success('Deleted')
      router.refresh()
    } finally {
      setDeletingId(null)
    }
  }

  // Duplicate the row's content into a new "Copy of …" draft. Server copies
  // the brief, briefData, folder, notes, and ICPs; annotations are skipped.
  // Refresh so the new row shows up in the list immediately.
  const handleDuplicate = async (id: string) => {
    setDuplicatingId(id)
    try {
      const res = await fetch(`/api/content/${id}/duplicate`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.id) { toast.error(data?.error ?? 'Could not duplicate'); return }
      toast.success(`Duplicated as "${data.topic}"`)
      router.refresh()
    } catch {
      toast.error('Could not duplicate')
    } finally {
      setDuplicatingId(null)
    }
  }

  const handleCreateFolder = async () => {
    const name = newName.trim()
    if (!name) return
    setCreating(true)
    try {
      const res = await fetch('/api/content-folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data?.error ?? 'Could not create folder'); return }
      setFolders((prev) => [...prev, data.folder])
      setNewName('')
      toast.success(`Folder "${name}" created`)
    } finally {
      setCreating(false)
    }
  }

  const handleRenameFolder = async (id: string) => {
    const name = renameValue.trim()
    if (!name) { setRenamingId(null); return }
    const res = await fetch(`/api/content-folders/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    const data = await res.json()
    if (!res.ok) { toast.error(data?.error ?? 'Could not rename'); return }
    setFolders((prev) => prev.map((f) => (f.id === id ? { ...f, name } : f)))
    setRenamingId(null)
    toast.success('Renamed')
  }

  const handleDeleteFolder = async (id: string, name: string) => {
    if (!confirm(`Delete folder "${name}"? Its content stays — items just become uncategorised.`)) return
    const res = await fetch(`/api/content-folders/${id}`, { method: 'DELETE' })
    if (!res.ok) { toast.error('Could not delete folder'); return }
    setFolders((prev) => prev.filter((f) => f.id !== id))
    if (activeFolder === id) setActiveFolder(ALL)
    toast.success('Folder deleted')
    router.refresh()
  }

  const handleMove = async (contentId: string, folderId: string | null) => {
    setMovingId(contentId)
    try {
      const res = await fetch(`/api/content/${contentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderId }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data?.error ?? 'Could not move'); return }
      toast.success(folderId ? 'Moved to folder' : 'Removed from folder')
      router.refresh()
    } finally {
      setMovingId(null)
    }
  }

  const folderName = (id: string | null) => folders.find((f) => f.id === id)?.name ?? null

  return (
    <div className="grid gap-5 lg:grid-cols-[220px_1fr]">
      {/* ── Folder sidebar ─────────────────────────────────────────────── */}
      <aside className="space-y-1">
        <FolderButton
          icon={<FolderOpen className="h-4 w-4" />}
          label="All content"
          count={items.length}
          active={activeFolder === ALL}
          onClick={() => setActiveFolder(ALL)}
        />
        <FolderButton
          icon={<Inbox className="h-4 w-4" />}
          label="Uncategorised"
          count={unfiledCount}
          active={activeFolder === UNFILED}
          onClick={() => setActiveFolder(UNFILED)}
        />

        <div className="pt-2 pb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Folders
        </div>

        {folders.map((f) => (
          <div key={f.id} className="group/folder relative">
            {renamingId === f.id ? (
              <div className="flex items-center gap-1 px-1">
                <Input
                  autoFocus
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleRenameFolder(f.id)
                    if (e.key === 'Escape') setRenamingId(null)
                  }}
                  className="h-8 text-sm"
                />
                <Button size="icon-sm" variant="ghost" onClick={() => handleRenameFolder(f.id)}><Check className="h-3.5 w-3.5" /></Button>
                <Button size="icon-sm" variant="ghost" onClick={() => setRenamingId(null)}><X className="h-3.5 w-3.5" /></Button>
              </div>
            ) : (
              <div className="flex items-center">
                <FolderButton
                  icon={<Folder className="h-4 w-4" />}
                  label={f.name}
                  count={f.count}
                  active={activeFolder === f.id}
                  onClick={() => setActiveFolder(f.id)}
                />
                <div className="absolute right-1 top-1/2 -translate-y-1/2 hidden group-hover/folder:flex items-center gap-0.5 bg-secondary/80 rounded">
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    className="h-6 w-6"
                    onClick={() => { setRenamingId(f.id); setRenameValue(f.name) }}
                    aria-label="Rename folder"
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    className="h-6 w-6 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDeleteFolder(f.id, f.name)}
                    aria-label="Delete folder"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}

        {/* New folder inline input */}
        <div className="flex items-center gap-1 px-1 pt-1">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleCreateFolder() }}
            placeholder="New folder…"
            className="h-8 text-sm"
          />
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={handleCreateFolder}
            disabled={creating || !newName.trim()}
            aria-label="Create folder"
          >
            {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FolderPlus className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </aside>

      {/* ── Content list ───────────────────────────────────────────────── */}
      <div>
        <div className="bg-card border border-border shadow-sm p-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search briefs…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="h-10 px-3 text-sm bg-background border border-input focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="all">All types</option>
            <option value="article">Article</option>
            <option value="catalog">Catalog</option>
            <option value="linkedin">LinkedIn</option>
            <option value="telegram">Telegram</option>
          </select>
          <p className="text-xs text-muted-foreground ml-auto tabular-nums">
            {filtered.length} of {items?.length ?? 0}
          </p>
        </div>

        {filtered.length === 0 ? (
          <div className="mt-6 p-12 text-center bg-card border border-border">
            <Sparkles className="h-10 w-10 mx-auto text-muted-foreground" />
            <h3 className="mt-3 font-display text-lg font-semibold tracking-tight">
              {activeFolder === ALL ? 'No briefs yet' : 'Nothing in this view'}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {activeFolder === ALL ? 'Generate your first AI brief.' : 'Move content here or pick another folder.'}
            </p>
            {activeFolder === ALL && (
              <Button asChild className="mt-4">
                <Link href="/content/new">Generate brief</Link>
              </Button>
            )}
          </div>
        ) : (
          <div className="mt-6 bg-card border border-border shadow-sm divide-y divide-border">
            {filtered.map((c) => {
              const meta = TYPES[c?.contentType] ?? TYPES.article
              const Icon = meta.icon
              const fName = folderName(c.folderId)
              return (
                <div key={c?.id} className="flex items-start gap-4 px-5 py-4 hover:bg-secondary/50 transition-colors">
                  <div className="flex h-10 w-10 items-center justify-center bg-secondary shrink-0">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex items-center pt-1.5">
                    <AnnotationStatusDot
                      unresolvedCount={(c as any).unresolvedAnnotationCount ?? 0}
                      totalCount={(c as any).annotationCount ?? 0}
                      size="md"
                    />
                  </div>
                  <Link href={`/content/${c?.id}`} className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm truncate">{c?.topic}</p>
                      <span className="text-[10px] uppercase tracking-widest bg-secondary px-1.5 py-0.5 text-muted-foreground font-medium">
                        {meta.label}
                      </span>
                      {fName && (
                        <span className="inline-flex items-center gap-1 text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                          <Folder className="h-2.5 w-2.5" /> {fName}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 truncate">
                      {c?.targetAudience} • {c?.tone}
                    </p>
                  </Link>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {c?.createdAt ? formatDistanceToNow(new Date(c.createdAt), { addSuffix: true }) : ''}
                    </span>

                    {/* Move-to-folder menu */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm" aria-label="Move to folder" disabled={movingId === c.id} className="text-muted-foreground">
                          {movingId === c.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FolderInput className="h-3.5 w-3.5" />}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-52">
                        <DropdownMenuLabel className="text-xs">Move to folder</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {folders.length === 0 ? (
                          <DropdownMenuItem disabled className="text-xs text-muted-foreground">
                            No folders — create one on the left
                          </DropdownMenuItem>
                        ) : (
                          folders.map((f) => (
                            <DropdownMenuItem
                              key={f.id}
                              onClick={() => handleMove(c.id, f.id)}
                              disabled={c.folderId === f.id}
                              className="gap-2"
                            >
                              <Folder className="h-3.5 w-3.5" />
                              <span className="truncate">{f.name}</span>
                              {c.folderId === f.id && <Check className="h-3 w-3 ml-auto" />}
                            </DropdownMenuItem>
                          ))
                        )}
                        {c.folderId && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleMove(c.id, null)} className="gap-2 text-muted-foreground">
                              <Inbox className="h-3.5 w-3.5" /> Remove from folder
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>

                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => handleDuplicate(c?.id)}
                      disabled={duplicatingId === c?.id || deletingId === c?.id}
                      aria-label="Duplicate"
                      title="Duplicate as new draft"
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <Files className="h-3.5 w-3.5" />
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => handleDelete(c?.id)}
                      disabled={deletingId === c?.id || duplicatingId === c?.id}
                      aria-label="Delete"
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function FolderButton({
  icon, label, count, active, onClick,
}: {
  icon: React.ReactNode
  label: string
  count: number
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm text-left transition-colors',
        active ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-secondary text-foreground',
      )}
    >
      <span className="shrink-0">{icon}</span>
      <span className="truncate flex-1">{label}</span>
      <span className="text-xs tabular-nums text-muted-foreground">{count}</span>
    </button>
  )
}
