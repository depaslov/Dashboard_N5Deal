'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Search, Users, Target, Trash2, Pencil, Briefcase } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'

interface Icp {
  id: string
  name: string
  industry: string
  companySize: string
  painPoints: string[]
  goals: string[]
  budgetRange: string
  updatedAt: string
}

export function IcpListClient({ icps }: { icps: Icp[] }) {
  const [query, setQuery] = useState('')
  const [industry, setIndustry] = useState<string>('all')
  const router = useRouter()
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const industries = useMemo(() => {
    const set = new Set<string>()
    ;(icps ?? []).forEach((i) => {
      if (i?.industry) set.add(i.industry)
    })
    return Array.from(set).sort()
  }, [icps])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (icps ?? []).filter((i) => {
      if (industry !== 'all' && i?.industry !== industry) return false
      if (!q) return true
      const hay = [
        i?.name,
        i?.industry,
        i?.companySize,
        i?.budgetRange,
        ...(i?.painPoints ?? []),
        ...(i?.goals ?? []),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
  }, [icps, query, industry])

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this ICP? This cannot be undone.')) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/icps/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        toast.error('Could not delete ICP')
        return
      }
      toast.success('ICP deleted')
      router.refresh()
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div>
      {/* Filters */}
      <div className="bg-card border border-border shadow-sm p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, pain, goal or budget…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <select
          value={industry}
          onChange={(e) => setIndustry(e.target.value)}
          className="h-10 px-3 text-sm bg-background border border-input focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="all">All industries</option>
          {industries.map((ind) => (
            <option key={ind} value={ind}>
              {ind}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground ml-auto tabular-nums">
          {filtered.length} of {icps?.length ?? 0}
        </p>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="mt-6 p-12 text-center bg-card border border-border">
          <Users className="h-10 w-10 mx-auto text-muted-foreground" />
          <h3 className="mt-3 font-display text-lg font-semibold tracking-tight">No ICPs found</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {icps?.length === 0 ? 'Create your first ideal customer profile.' : 'Try a different search or filter.'}
          </p>
          <Button asChild className="mt-4">
            <Link href="/icps/new">Create ICP</Link>
          </Button>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {filtered.map((i) => (
            <div key={i?.id} className="bg-card border border-border shadow-sm hover:shadow-md transition-shadow flex flex-col">
              <div className="p-5 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="flex h-10 w-10 items-center justify-center bg-primary text-primary-foreground shrink-0">
                      <Users className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-display font-semibold text-lg tracking-tight truncate">{i?.name}</h3>
                      <p className="text-xs text-muted-foreground truncate">
                        {i?.industry} • {i?.companySize}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button asChild variant="ghost" size="icon-sm">
                      <Link href={`/icps/${i?.id}`} aria-label="Edit">
                        <Pencil className="h-3.5 w-3.5" />
                      </Link>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => handleDelete(i?.id)}
                      disabled={deletingId === i?.id}
                      aria-label="Delete"
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  {(i?.painPoints ?? []).length > 0 ? (
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1.5">
                        Top pain points
                      </p>
                      <ul className="space-y-1">
                        {(i?.painPoints ?? []).slice(0, 2).map((p, idx) => (
                          <li key={idx} className="text-sm text-foreground flex gap-2">
                            <span className="h-1 w-1 bg-destructive mt-2 shrink-0" />
                            <span className="line-clamp-2">{p}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {(i?.goals ?? []).length > 0 ? (
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1.5">
                        Goals
                      </p>
                      <ul className="space-y-1">
                        {(i?.goals ?? []).slice(0, 2).map((g, idx) => (
                          <li key={idx} className="text-sm text-foreground flex gap-2">
                            <Target className="h-3 w-3 mt-1 shrink-0 text-accent" />
                            <span className="line-clamp-2">{g}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              </div>
              <div className="px-5 py-3 border-t border-border flex items-center justify-between bg-secondary/40">
                <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                  <Briefcase className="h-3 w-3" /> {i?.budgetRange || '—'}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  Updated {i?.updatedAt ? formatDistanceToNow(new Date(i.updatedAt), { addSuffix: true }) : ''}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
