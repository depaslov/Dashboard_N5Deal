import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getOrCreateCurrentProject } from '@/lib/project'
import { Target } from 'lucide-react'

export const dynamic = 'force-dynamic'

const CHANNEL_COLORS: Record<string, string> = {
  linkBuilding: 'bg-emerald-500',
  linkedin: 'bg-blue-600',
  instagram: 'bg-pink-500',
  pr: 'bg-violet-600',
  free: 'bg-slate-400',
}

const CHANNEL_LABELS: Record<string, string> = {
  linkBuilding: 'Link Building',
  linkedin: 'LinkedIn',
  instagram: 'Instagram',
  pr: 'PR',
  free: 'Free Sources',
}

export default async function MarketingStrategyPage() {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id as string
  const project = await getOrCreateCurrentProject(userId)

  const strategy = await prisma.marketingStrategy.findUnique({ where: { projectId: project.id } })

  if (!strategy || !strategy.budget) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card py-16 px-6 text-center">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 mb-4">
          <Target className="h-6 w-6 text-primary" />
        </div>
        <h3 className="font-semibold">No strategy seeded yet</h3>
        <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
          Run the seed script to import the Q2 budget plan and channel goals from the original
          Marketing OS prototype.
        </p>
      </div>
    )
  }

  const month = strategy.activeBudgetMonth
  const monthBudget = (strategy.budget as Record<string, Record<string, { min: number; max: number; actual: number; purpose: string }>>)[month] ?? {}

  return (
    <div className="space-y-6">
      <header>
        <h2 className="font-display text-2xl font-semibold tracking-tight">Q2 Strategy</h2>
        <p className="text-sm text-muted-foreground">
          Editable goal + budget tracker — read-only in this build (full editing arrives in Phase 3).
        </p>
      </header>

      <section className="bg-card border border-border rounded-lg shadow-sm">
        <header className="px-5 py-3.5 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold">Budget — {month.charAt(0).toUpperCase() + month.slice(1)} 2026</h3>
        </header>
        <div className="p-5 space-y-4">
          {Object.entries(monthBudget).map(([ch, data]) => {
            const fillPct = data.max > 0 ? Math.min(100, (data.actual / data.max) * 100) : 0
            const range = data.min === data.max ? `$${data.max.toLocaleString()}` : `$${data.min.toLocaleString()}–${data.max.toLocaleString()}`
            return (
              <div key={ch}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="font-medium flex items-center gap-2">
                    <span className={`inline-block w-2 h-2 rounded-full ${CHANNEL_COLORS[ch] ?? 'bg-muted'}`} />
                    {CHANNEL_LABELS[ch] ?? ch}
                  </span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    <span className="text-foreground font-semibold">${data.actual.toLocaleString()}</span> / {range}
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${CHANNEL_COLORS[ch] ?? 'bg-primary'}`} style={{ width: `${fillPct}%` }} />
                </div>
                {data.purpose ? (
                  <p className="text-xs text-muted-foreground mt-1.5">{data.purpose}</p>
                ) : null}
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
