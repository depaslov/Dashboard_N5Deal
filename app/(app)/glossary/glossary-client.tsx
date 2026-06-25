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
import { Plus, Trash2, Upload, BookOpen, Search, Pencil } from 'lucide-react'
import { toast } from 'sonner'

interface GlossaryEntry {
  id: string
  phrase: string
  definition: string
  slug: string
  language: string
}

const LANGUAGES = [
  { key: 'en', label: 'English' },
  { key: 'uk', label: 'Ukrainian' },
  { key: 'ru', label: 'Russian' },
] as const

interface Props {
  initialEntries: GlossaryEntry[]
}

export function GlossaryClient({ initialEntries }: Props) {
  const router = useRouter()
  const [entries, setEntries] = useState<GlossaryEntry[]>(initialEntries)
  const [search, setSearch] = useState('')
  const [languageFilter, setLanguageFilter] = useState<string>('all')

  // Add / edit dialog state
  const [addOpen, setAddOpen] = useState(false)
  const [addPhrase, setAddPhrase] = useState('')
  const [addDefinition, setAddDefinition] = useState('')
  const [addLanguage, setAddLanguage] = useState<string>('en')

  const [editEntry, setEditEntry] = useState<GlossaryEntry | null>(null)
  const [editPhrase, setEditPhrase] = useState('')
  const [editDefinition, setEditDefinition] = useState('')
  const [editLanguage, setEditLanguage] = useState<string>('en')

  // Bulk import dialog
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkRaw, setBulkRaw] = useState('')
  const [bulkLanguage, setBulkLanguage] = useState<string>('en')
  const [busy, setBusy] = useState(false)

  const filtered = useMemo(() => {
    let list = entries
    if (languageFilter !== 'all') list = list.filter((e) => e.language === languageFilter)
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(
        (e) => e.phrase.toLowerCase().includes(q) || e.definition.toLowerCase().includes(q),
      )
    }
    return list
  }, [entries, languageFilter, search])

  async function addEntry() {
    if (!addPhrase.trim() || !addDefinition.trim()) {
      toast.error('Phrase and definition are required')
      return
    }
    setBusy(true)
    try {
      const res = await fetch('/api/glossary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phrase: addPhrase.trim(),
          definition: addDefinition.trim(),
          language: addLanguage,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data?.error ?? 'Could not add entry')
        return
      }
      setEntries((prev) => {
        const next = prev.filter((e) => e.id !== data.entry.id)
        return [...next, data.entry].sort((a, b) =>
          a.language === b.language ? a.phrase.localeCompare(b.phrase) : a.language.localeCompare(b.language),
        )
      })
      setAddPhrase('')
      setAddDefinition('')
      setAddOpen(false)
      toast.success('Entry saved')
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  function openEdit(entry: GlossaryEntry) {
    setEditEntry(entry)
    setEditPhrase(entry.phrase)
    setEditDefinition(entry.definition)
    setEditLanguage(entry.language)
  }

  async function saveEdit() {
    if (!editEntry) return
    if (!editPhrase.trim() || !editDefinition.trim()) {
      toast.error('Phrase and definition are required')
      return
    }
    setBusy(true)
    try {
      const res = await fetch(`/api/glossary/${editEntry.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phrase: editPhrase.trim(),
          definition: editDefinition.trim(),
          language: editLanguage,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data?.error ?? 'Could not update entry')
        return
      }
      setEntries((prev) =>
        prev
          .map((e) => (e.id === data.entry.id ? data.entry : e))
          .sort((a, b) =>
            a.language === b.language ? a.phrase.localeCompare(b.phrase) : a.language.localeCompare(b.language),
          ),
      )
      setEditEntry(null)
      toast.success('Entry updated')
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  async function removeEntry(id: string) {
    if (!confirm('Delete this entry?')) return
    const res = await fetch(`/api/glossary/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      toast.error(data?.error ?? 'Could not delete')
      return
    }
    setEntries((prev) => prev.filter((e) => e.id !== id))
    toast.success('Entry deleted')
    router.refresh()
  }

  async function bulkImport() {
    const raw = bulkRaw.trim()
    if (!raw) {
      toast.error('Paste at least one line')
      return
    }
    setBusy(true)
    try {
      const res = await fetch('/api/glossary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw, language: bulkLanguage }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data?.error ?? 'Could not import')
        if (Array.isArray(data?.skipped) && data.skipped.length > 0) {
          console.warn('Bulk import skipped lines:', data.skipped)
        }
        return
      }
      // Merge into local state — `data.entries` are full Prisma records.
      const created: GlossaryEntry[] = data.entries
      setEntries((prev) => {
        const byId = new Map<string, GlossaryEntry>()
        for (const e of prev) byId.set(e.id, e)
        for (const e of created) byId.set(e.id, e)
        return Array.from(byId.values()).sort((a, b) =>
          a.language === b.language ? a.phrase.localeCompare(b.phrase) : a.language.localeCompare(b.language),
        )
      })
      const msg = `Imported ${data.created} entr${data.created === 1 ? 'y' : 'ies'}`
      const extras: string[] = []
      if (data.skipped?.length) extras.push(`${data.skipped.length} skipped`)
      if (data.duplicatesInPaste) extras.push(`${data.duplicatesInPaste} duplicates in paste`)
      toast.success(extras.length ? `${msg} (${extras.join(', ')})` : msg)
      setBulkRaw('')
      setBulkOpen(false)
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search phrase or definition…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <select
          value={languageFilter}
          onChange={(e) => setLanguageFilter(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="all">All languages</option>
          {LANGUAGES.map((l) => (
            <option key={l.key} value={l.key}>
              {l.label}
            </option>
          ))}
        </select>

        <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
          <DialogTrigger asChild>
            <Button variant="outline">
              <Upload className="h-4 w-4 mr-1" />
              Bulk import
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Bulk import entries</DialogTitle>
              <DialogDescription>
                Paste one entry per line. Auto-detects separator:{' '}
                <code className="text-xs bg-muted px-1 rounded">phrase | definition</code>,{' '}
                <code className="text-xs bg-muted px-1 rounded">phrase: definition</code>,{' '}
                <code className="text-xs bg-muted px-1 rounded">phrase — definition</code>, tab, or markdown
                table. Existing phrases get their definition updated.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label htmlFor="bulk-lang">Language for all imported entries</Label>
                <select
                  id="bulk-lang"
                  value={bulkLanguage}
                  onChange={(e) => setBulkLanguage(e.target.value)}
                  className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {LANGUAGES.map((l) => (
                    <option key={l.key} value={l.key}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="bulk-raw">Entries</Label>
                <Textarea
                  id="bulk-raw"
                  value={bulkRaw}
                  onChange={(e) => setBulkRaw(e.target.value)}
                  rows={14}
                  placeholder={`EMI License | Electronic Money Institution authorisation issued by EU regulators...\nPSP License | Payment Service Provider authorisation for...\n...`}
                  className="font-mono text-xs"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setBulkOpen(false)} disabled={busy}>
                Cancel
              </Button>
              <Button onClick={bulkImport} disabled={busy}>
                {busy ? 'Importing…' : 'Import'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-1" />
              Add entry
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>Add glossary entry</DialogTitle>
              <DialogDescription>One phrase + one definition. Slug is auto-derived from the phrase.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label htmlFor="add-phrase">Phrase</Label>
                <Input
                  id="add-phrase"
                  value={addPhrase}
                  onChange={(e) => setAddPhrase(e.target.value)}
                  placeholder="EMI License"
                />
              </div>
              <div>
                <Label htmlFor="add-def">Definition</Label>
                <Textarea
                  id="add-def"
                  value={addDefinition}
                  onChange={(e) => setAddDefinition(e.target.value)}
                  rows={5}
                  placeholder="Electronic Money Institution authorisation issued by EU regulators…"
                />
              </div>
              <div>
                <Label htmlFor="add-lang">Language</Label>
                <select
                  id="add-lang"
                  value={addLanguage}
                  onChange={(e) => setAddLanguage(e.target.value)}
                  className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {LANGUAGES.map((l) => (
                    <option key={l.key} value={l.key}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddOpen(false)} disabled={busy}>
                Cancel
              </Button>
              <Button onClick={addEntry} disabled={busy}>
                {busy ? 'Saving…' : 'Add'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Two-column table */}
      <div className="border rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left px-3 py-2 font-medium w-1/3">Phrase</th>
              <th className="text-left px-3 py-2 font-medium">Definition</th>
              <th className="text-right px-3 py-2 font-medium w-[120px]">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-3 py-8 text-center text-muted-foreground">
                  {entries.length === 0 ? (
                    <div className="flex flex-col items-center gap-2">
                      <BookOpen className="h-6 w-6" />
                      <div>No entries yet — add one or bulk-import.</div>
                    </div>
                  ) : (
                    'No matches for the current filter.'
                  )}
                </td>
              </tr>
            ) : (
              filtered.map((e) => (
                <tr key={e.id} className="border-t hover:bg-muted/30">
                  <td className="px-3 py-2 align-top">
                    <div className="font-medium">{e.phrase}</div>
                    <div className="text-xs text-muted-foreground mt-0.5 flex gap-2 items-center">
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {e.language}
                      </Badge>
                      <code className="text-[10px]">/{e.slug}</code>
                    </div>
                  </td>
                  <td className="px-3 py-2 align-top whitespace-pre-wrap">{e.definition}</td>
                  <td className="px-3 py-2 align-top text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(e)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => removeEntry(e.id)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="text-xs text-muted-foreground">
        {entries.length} total &middot; {filtered.length} shown
      </div>

      {/* Edit dialog */}
      <Dialog open={!!editEntry} onOpenChange={(o) => !o && setEditEntry(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Edit entry</DialogTitle>
            <DialogDescription>Slug is regenerated automatically if the phrase changes.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="edit-phrase">Phrase</Label>
              <Input id="edit-phrase" value={editPhrase} onChange={(e) => setEditPhrase(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="edit-def">Definition</Label>
              <Textarea
                id="edit-def"
                value={editDefinition}
                onChange={(e) => setEditDefinition(e.target.value)}
                rows={6}
              />
            </div>
            <div>
              <Label htmlFor="edit-lang">Language</Label>
              <select
                id="edit-lang"
                value={editLanguage}
                onChange={(e) => setEditLanguage(e.target.value)}
                className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {LANGUAGES.map((l) => (
                  <option key={l.key} value={l.key}>
                    {l.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditEntry(null)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={saveEdit} disabled={busy}>
              {busy ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
