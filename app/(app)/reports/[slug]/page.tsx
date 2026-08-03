import { notFound } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getOrCreateCurrentProject } from '@/lib/project'
import { ReportPageClient } from '@/components/app/report-page-client'

export const dynamic = 'force-dynamic'

export default async function ReportPage({ params }: { params: { slug: string } }) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id as string
  const project = await getOrCreateCurrentProject(userId)

  const report = await prisma.operationalReport.findUnique({
    where: { projectId_slug: { projectId: project.id, slug: params.slug } },
  })
  if (!report) notFound()

  return (
    <ReportPageClient
      report={{
        id: report.id,
        slug: report.slug,
        title: report.title,
        periodLabel: report.periodLabel,
        subtitle: report.subtitle,
        kind: report.kind,
        bodyHtml: report.bodyHtml,
      }}
    />
  )
}
