'use client'

import { useEffect, useState } from 'react'
import { Users, Sparkles, FolderKanban, FileText, type LucideIcon } from 'lucide-react'

const ICON_MAP: Record<string, LucideIcon> = {
  users: Users,
  sparkles: Sparkles,
  folder: FolderKanban,
  file: FileText,
}

interface Props {
  label: string
  value: number
  iconName: keyof typeof ICON_MAP
  hint?: string
  accent?: 'default' | 'accent' | 'success' | 'warning'
}

export function StatCard({ label, value, iconName, hint, accent = 'default' }: Props) {
  const Icon = ICON_MAP[iconName] ?? Users
  const safeValue = typeof value === 'number' && !isNaN(value) ? value : 0
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    const duration = 700
    const start = performance.now()
    const from = 0
    const to = safeValue
    let raf = 0
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplay(Math.round(from + (to - from) * eased))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [safeValue])

  const iconStyles =
    accent === 'accent'
      ? 'bg-accent text-accent-foreground'
      : accent === 'success'
      ? 'bg-emerald-600 text-white'
      : accent === 'warning'
      ? 'bg-amber-500 text-white'
      : 'bg-primary text-primary-foreground'

  return (
    <div className="bg-card border border-border p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">
            {label}
          </p>
          <p className="mt-3 font-display text-3xl font-semibold tracking-tight tabular-nums">
            {display.toLocaleString()}
          </p>
          {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
        </div>
        <div className={`flex h-10 w-10 items-center justify-center ${iconStyles}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  )
}
