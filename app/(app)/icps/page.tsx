import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getOrCreateCurrentProject } from '@/lib/project'
import { PageHeader } from '@/components/app/page-header'
import { Button } from '@/components/ui/button'
import { IcpListClient } from './icp-list-client'
import { Plus } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function ICPsPage() {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id as string
  const project = await getOrCreateCurrentProject(userId)

  const icps = await prisma.iCP.findMany({
    where: { projectId: project.id },
    orderBy: { updatedAt: 'desc' },
  })

  return (
    <div className="max-w-[1200px] mx-auto">
      <PageHeader
        title="ICP Management"
        description="Structured profiles of your ideal customers — pains, goals, budget, decision process."
        actions={
          <Button asChild>
            <Link href="/icps/new" className="gap-2">
              <Plus className="h-4 w-4" /> New ICP
            </Link>
          </Button>
        }
      />
      <IcpListClient
        icps={icps.map((i: any) => ({
          id: i.id,
          name: i.name,
          industry: i.industry,
          companySize: i.companySize,
          painPoints: i.painPoints ?? [],
          goals: i.goals ?? [],
          budgetRange: i.budgetRange,
          updatedAt: i.updatedAt.toISOString(),
        }))}
      />
    </div>
  )
}
