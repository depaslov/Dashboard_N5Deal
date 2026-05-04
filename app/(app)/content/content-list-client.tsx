'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Search, Sparkles, FileText, BookOpen, Linkedin, Send, Clock, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'

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
}

export function ContentListClient({ items }: { items: Item[] }) {
  const [query, setQuery] = useState('')
  const [type, setType] = useState<string>('all')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const router = useRouter()

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (items ?? []).filter((i) => {
      if (type !== 'all' && i?.contentType !== type) return false
      if (!q) return true
      return [i?.topic, i?.targetAudience, i?.tone].filter(Boolean).join(' ').toLowerCase().includes(q)
    })
  }, [items, query, type])

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this brief?')) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/content/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        toast.error('Could not delete')
        return
      }
      toast.success('Deleted')
      router.refresh()
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div>
      <div className="bg-card border border-border shadow-sm p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
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
          <h3 className="mt-3 font-display text-lg font-semibold tracking-tight">No briefs yet</h3>
          <p className="mt-1 text-sm text-muted-foreground">Generate your first AI brief.</p>
          <Button asChild className="mt-4">
            <Link href="/content/new">Generate brief</Link>
          </Button>
        </div>
      ) : (
        <div className="mt-6 bg-card border border-border shadow-sm divide-y divide-border">
          {filtered.map((c) => {
            const meta = TYPES[c?.contentType] ?? TYPES.article
            const Icon = meta.icon
            return (
              <div key={c?.id} className="flex items-start gap-4 px-5 py-4 hover:bg-secondary/50 transition-colors">
                <div className="flex h-10 w-10 items-center justify-center bg-secondary shrink-0">
                  <Icon className="h-4 w-4" />
                </div>
                <Link href={`/content/${c?.id}`} className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-sm truncate">{c?.topic}</p>
                    <span className="text-[10px] uppercase tracking-widest bg-secondary px-1.5 py-0.5 text-muted-foreground font-medium">
                      {meta.label}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 truncate">
                    {c?.targetAudience} • {c?.tone}
                  </p>
                </Link>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {c?.createdAt ? formatDistanceToNow(new Date(c.createdAt), { addSuffix: true }) : ''}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => handleDelete(c?.id)}
                    disabled={deletingId === c?.id}
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
  )
}
