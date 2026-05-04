import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { assertProjectAccess } from '@/lib/project'
import { PageHeader } from '@/components/app/page-header'
import { Button } from '@/components/ui/button'
import { IcpForm } from '@/components/app/icp-form'
import { IcpTagPicker } from '@/components/app/icp-tag-picker'
import { ArrowLeft } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function EditIcpPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id as string
  const icp = await prisma.iCP.findUnique({ where: { id: params.id } })
  if (!icp) notFound()
  const canAccess = await assertProjectAccess(userId, icp.projectId)
  if (!canAccess) notFound()

  const [assignedLinks, projectTags] = await Promise.all([
    prisma.iCPTag.findMany({
      where: { icpId: icp.id },
      include: { tag: true },
      orderBy: [{ tag: { name: 'asc' } }],
    }),
    prisma.tag.findMany({
      where: { projectId: icp.projectId },
      orderBy: { name: 'asc' },
    }),
  ])

  return (
    <div className="max-w-[900px] mx-auto">
      <div className="mb-4">
        <Button asChild variant="ghost" size="sm">
          <Link href="/icps" className="gap-1">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to ICPs
          </Link>
        </Button>
      </div>
      <PageHeader
        title={icp.name}
        description="Edit this ideal customer profile. Changes will apply to new content briefs."
      />
      <IcpForm
        mode="edit"
        icp={{
          id: icp.id,
          name: icp.name,
          industry: icp.industry,
          companySize: icp.companySize,
          painPoints: icp.painPoints,
          goals: icp.goals,
          demographics: icp.demographics,
          budgetRange: icp.budgetRange,
          decisionProcess: icp.decisionProcess,
        }}
      />
      <div className="mt-6">
        <IcpTagPicker
          icpId={icp.id}
          initialAssigned={assignedLinks.map((l) => ({
            id: l.tag.id,
            name: l.tag.name,
            color: l.tag.color,
          }))}
          initialAvailable={projectTags.map((t) => ({
            id: t.id,
            name: t.name,
            color: t.color,
          }))}
        />
      </div>
    </div>
  )
}
