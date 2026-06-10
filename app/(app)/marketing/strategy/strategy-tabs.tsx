'use client'

import { useState, type ReactNode } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

type TabKey = 'strategy' | 'four-path' | 'social' | 'link-building' | 'notes'

const TABS: { k: TabKey; label: string; hint: string }[] = [
  { k: 'strategy',      label: 'Strategy',         hint: 'Q2-Q4 plan: budgets, goals, directives, authority layer' },
  { k: 'four-path',     label: 'Four-path',        hint: 'DR · Awareness · Lead Gen · Product Promotion — channel matrix' },
  { k: 'social',        label: 'Social Media',     hint: 'Platform-by-platform mechanics + winning formats (Jun 2026)' },
  { k: 'link-building', label: 'Link Building',    hint: 'Earning links across Medium, Reddit, Web 2.0, guest sites' },
  { k: 'notes',         label: 'Notes',            hint: 'Free-form HTML notes — agency briefs, meeting recaps, references' },
]

export function StrategyTabs({
  strategyContent,
  fourPathContent,
  socialContent,
  linkBuildingContent,
  notesContent,
}: {
  strategyContent: ReactNode
  fourPathContent: ReactNode
  socialContent: ReactNode
  linkBuildingContent: ReactNode
  notesContent: ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const initial = (params.get('tab') as TabKey | null) ?? 'strategy'
  const [tab, setTab] = useState<TabKey>(initial)

  function changeTab(next: TabKey) {
    setTab(next)
    const q = new URLSearchParams(params.toString())
    if (next === 'strategy') q.delete('tab')
    else q.set('tab', next)
    const qs = q.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  const activeTab = TABS.find((t) => t.k === tab) ?? TABS[0]

  return (
    <div className="space-y-4">
      {/* Tab bar */}
      <div className="border-b border-border">
        <nav className="flex gap-1 overflow-x-auto" aria-label="Strategy tabs">
          {TABS.map((t) => (
            <button
              key={t.k}
              type="button"
              onClick={() => changeTab(t.k)}
              className={cn(
                'px-3 py-2 text-sm font-semibold border-b-2 -mb-px whitespace-nowrap transition-colors',
                tab === t.k
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>
      <p className="text-xs text-muted-foreground -mt-2">{activeTab.hint}</p>

      {/* Tab content */}
      {tab === 'strategy' ? strategyContent : null}
      {tab === 'four-path' ? fourPathContent : null}
      {tab === 'social' ? socialContent : null}
      {tab === 'link-building' ? linkBuildingContent : null}
      {tab === 'notes' ? notesContent : null}
    </div>
  )
}
