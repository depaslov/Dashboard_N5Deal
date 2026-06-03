import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getOrCreateCurrentProject } from '@/lib/project'
import { Target } from 'lucide-react'
import { StrategyEditor, type BudgetData, type GoalsData, type CurrentState, type AuthorityLayer } from './strategy-editor'

export const dynamic = 'force-dynamic'

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
          Run <code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">scripts/seed-marketing-os.ts</code> to import the Q2 plan.
        </p>
      </div>
    )
  }

  return (
    <StrategyEditor
      initial={{
        activeBudgetMonth: strategy.activeBudgetMonth as 'april' | 'may' | 'june' | 'q3' | 'q4',
        budget: strategy.budget as BudgetData,
        goals: (strategy.goals as GoalsData | null) ?? {},
        channelDirectives:
          (strategy.channelDirectives as Record<
            string,
            { title: string; color: string; body: string }
          > | null) ?? {},
        currentState: (strategy.currentState as CurrentState | null) ?? null,
        authorityLayer: (strategy.authorityLayer as AuthorityLayer | null) ?? null,
      }}
    />
  )
}
