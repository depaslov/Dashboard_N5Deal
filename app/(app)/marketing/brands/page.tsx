import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getOrCreateCurrentProject } from '@/lib/project'
import { Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

export const dynamic = 'force-dynamic'

const PRIORITY_BADGE: Record<string, string> = {
  urgent: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
  high: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  medium: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  low: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
}

const STATUS_ICON: Record<string, string> = {
  todo: '○',
  inprogress: '◐',
  done: '●',
}

export default async function MarketingBrandsPage() {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id as string
  const project = await getOrCreateCurrentProject(userId)

  const brands = await prisma.brand.findMany({
    where: { projectId: project.id },
    orderBy: { sortOrder: 'asc' },
  })

  if (brands.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card py-16 px-6 text-center">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 mb-4">
          <Sparkles className="h-6 w-6 text-primary" />
        </div>
        <h3 className="font-semibold">No brand cards yet</h3>
        <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
          Seed N5Deal · BankStore · M&amp;A House brand profiles + deliverables from the prototype:
        </p>
        <code className="inline-block mt-3 text-[11px] font-mono bg-muted px-2.5 py-1 rounded">
          npx tsx --require dotenv/config scripts/seed-marketing-os.ts
        </code>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {brands.map((b) => {
        const features = (b.features as string[] | null) ?? []
        const deliverables = (b.deliverables as { id: string; text: string; status: string; priority: string }[] | null) ?? []
        return (
          <section key={b.id} className="bg-card border border-border rounded-lg shadow-sm overflow-hidden">
            <header className="border-l-4 border-primary px-5 py-4">
              <h3 className="font-display text-xl font-semibold tracking-tight">{b.name}</h3>
              {b.tagline ? <p className="text-sm text-muted-foreground mt-0.5">{b.tagline}</p> : null}
            </header>
            <div className="px-5 pb-5 space-y-4">
              {b.pitch ? (
                <p className="text-sm leading-relaxed border-l-2 border-border pl-4 italic text-foreground/80">
                  {b.pitch}
                </p>
              ) : null}
              {features.length ? (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Features</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {features.map((f, i) => (
                      <div key={i} className="text-xs bg-muted/50 rounded px-3 py-2">{f}</div>
                    ))}
                  </div>
                </div>
              ) : null}
              {deliverables.length ? (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Deliverables</p>
                  <ul className="space-y-1.5">
                    {deliverables.map((d) => (
                      <li key={d.id} className="flex items-center gap-3 text-sm bg-muted/30 rounded px-3 py-2">
                        <span className="text-lg leading-none" style={{ color: d.status === 'done' ? 'var(--primary)' : undefined }}>
                          {STATUS_ICON[d.status] ?? '○'}
                        </span>
                        <span className="flex-1">{d.text}</span>
                        <Badge variant="secondary" className={`text-[10px] ${PRIORITY_BADGE[d.priority] ?? ''}`}>
                          {d.priority}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </section>
        )
      })}
    </div>
  )
}
