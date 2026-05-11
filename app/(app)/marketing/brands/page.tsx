import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getOrCreateCurrentProject } from '@/lib/project'
import { Sparkles } from 'lucide-react'
import { BrandsEditor, type BrandData } from './brands-editor'

export const dynamic = 'force-dynamic'

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
          Run <code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">scripts/seed-marketing-os.ts</code> to import the brand cards.
        </p>
      </div>
    )
  }

  const data: BrandData[] = brands.map((b) => ({
    id: b.id,
    slug: b.slug,
    name: b.name,
    tagline: b.tagline ?? '',
    pitch: b.pitch ?? '',
    features: (b.features as string[] | null) ?? [],
    deliverables: ((b.deliverables ?? []) as unknown) as BrandData['deliverables'],
    notes: b.notes ?? '',
  }))

  return <BrandsEditor initial={data} />
}
