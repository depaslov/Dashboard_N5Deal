'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Check } from 'lucide-react'
import { toast } from 'sonner'

export interface PlatformOption {
  id: string
  name: string
  companyName: string
  brandBadge?: string | null
  brandColor?: string | null
}

function badgeFor(p: PlatformOption): string {
  if (p.brandBadge) return p.brandBadge
  const src = (p.companyName || p.name || '').trim()
  if (!src) return '—'
  const words = src.split(/\s+/)
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase()
  return src.slice(0, 2).toUpperCase()
}

/**
 * Big selectable platform cards for the dashboard home screen. Picking a card
 * switches the active project (same endpoint as the sidebar switcher) and
 * reloads so every module re-reads the new project.
 */
export function PlatformSwitcher({
  platforms,
  currentId,
}: {
  platforms: PlatformOption[]
  currentId: string
}) {
  const [switchingTo, setSwitchingTo] = useState<string | null>(null)

  const select = async (id: string) => {
    if (id === currentId || switchingTo) return
    setSwitchingTo(id)
    try {
      const res = await fetch('/api/projects/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: id }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data?.error ?? 'Could not switch platform')
        setSwitchingTo(null)
        return
      }
      window.location.reload()
    } catch {
      toast.error('Could not switch platform')
      setSwitchingTo(null)
    }
  }

  return (
    <div className="mb-8">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-2">
        Platform
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {platforms.map((p) => {
          const active = p.id === currentId
          const loading = switchingTo === p.id
          const color = p.brandColor ? `hsl(${p.brandColor})` : 'hsl(var(--primary))'
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => select(p.id)}
              disabled={loading || active}
              aria-pressed={active}
              className={cn(
                'group relative flex items-center gap-3 border p-4 text-left transition-all',
                active
                  ? 'border-primary ring-1 ring-primary bg-secondary/50'
                  : 'border-border bg-card hover:border-primary/50 hover:bg-secondary/40',
                loading && 'opacity-60'
              )}
            >
              <div
                className="flex h-11 w-11 items-center justify-center text-white font-display font-bold text-sm shrink-0"
                style={{ backgroundColor: color }}
              >
                {badgeFor(p)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm truncate">{p.name}</p>
                <p className="text-xs text-muted-foreground truncate">{p.companyName}</p>
              </div>
              {active ? (
                <span className="flex items-center gap-1 text-[11px] font-semibold text-primary shrink-0">
                  <Check className="h-3.5 w-3.5" /> Active
                </span>
              ) : (
                <span className="text-[11px] text-muted-foreground shrink-0">
                  {loading ? 'Switching…' : 'Switch'}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
