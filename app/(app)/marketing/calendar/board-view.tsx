'use client'

import { format } from 'date-fns'
import { ACCOUNT_ACCENT, ACCOUNT_BADGE, ACCOUNT_META, type AccountSlug } from '@/lib/marketing/constants'
import { cn } from '@/lib/utils'
import type { CalAccount, CalPost } from './types'

const COLUMNS: { k: string; label: string; dot: string }[] = [
  { k: 'idea', label: 'Idea', dot: 'bg-slate-400' },
  { k: 'wip', label: 'In Progress', dot: 'bg-blue-500' },
  { k: 'done', label: 'Done', dot: 'bg-emerald-500' },
  { k: 'pub', label: 'Published', dot: 'bg-amber-500' },
]

export function BoardView({
  accounts,
  posts,
  onPostClick,
}: {
  accounts: CalAccount[]
  posts: CalPost[]
  onPostClick: (post: CalPost) => void
}) {
  const accBySlug = Object.fromEntries(accounts.map((a) => [a.id, a]))
  const grouped: Record<string, CalPost[]> = { idea: [], wip: [], done: [], pub: [] }
  for (const p of posts) {
    const k = (COLUMNS.find((c) => c.k === p.status)?.k as string) ?? 'idea'
    grouped[k].push(p)
  }

  return (
    <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
      {COLUMNS.map((col) => (
        <div key={col.k} className="bg-muted/30 border border-border rounded-lg p-3">
          <header className="flex items-center gap-2 mb-3 px-1">
            <span className={cn('h-2 w-2 rounded-full', col.dot)} />
            <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              {col.label}
            </h3>
            <span className="ml-auto text-[10px] bg-card border border-border px-1.5 py-0.5 rounded text-muted-foreground font-medium">
              {grouped[col.k].length}
            </span>
          </header>
          <div className="space-y-1.5">
            {grouped[col.k].map((p) => {
              const acc = accBySlug[p.accountId]
              const slug = (acc?.slug ?? 'n5') as AccountSlug
              const meta = ACCOUNT_META[slug] ?? { name: acc?.name ?? '—' }
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onPostClick(p)}
                  className={cn(
                    'w-full text-left bg-card border border-border border-l-2 rounded p-2.5 hover:bg-accent/50 transition-colors',
                    p.type === 'Article' ? 'border-l-amber-600' : ACCOUNT_ACCENT[slug],
                  )}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <span
                      className={cn(
                        'text-[9px] font-bold uppercase tracking-wider px-1 py-0.5 rounded',
                        p.type === 'Article'
                          ? 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300'
                          : ACCOUNT_BADGE[slug],
                      )}
                    >
                      {meta.name} · {p.type}
                    </span>
                  </div>
                  <div className="text-xs leading-snug line-clamp-3">{p.title}</div>
                  <div className="text-[10px] text-muted-foreground mt-1.5 font-medium tabular-nums">
                    {format(new Date(p.scheduledFor), 'd LLL')}
                  </div>
                </button>
              )
            })}
            {grouped[col.k].length === 0 ? (
              <div className="text-[11px] text-muted-foreground text-center py-3 font-medium">— empty —</div>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  )
}
