import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getOrCreateCurrentProject } from '@/lib/project'
import { getEffectiveConnection } from '@/lib/analytics/require-access'
import { PageHeader } from '@/components/app/page-header'
import { IntegrationsClient } from './integrations-client'

export const dynamic = 'force-dynamic'

export default async function IntegrationsPage() {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id as string
  const project = await getOrCreateCurrentProject(userId)

  const [membership, connection] = await Promise.all([
    prisma.projectMember.findUnique({ where: { projectId_userId: { projectId: project.id, userId } } }),
    getEffectiveConnection(project.id),
  ])

  return (
    <div className="max-w-[1000px] mx-auto">
      <PageHeader
        title="Analytics integrations"
        description="Connect GA4, Search Console and Ahrefs for this workspace."
      />
      <IntegrationsClient
        role={membership?.role ?? 'member'}
        project={{ id: project.id, name: project.name }}
        connection={{
          ga4PropertyId: connection.ga4PropertyId ?? '',
          gscSiteUrl: connection.gscSiteUrl ?? '',
          ahrefsTarget: connection.ahrefsTarget ?? '',
          ahrefsMode: connection.ahrefsMode ?? 'domain',
          lastSyncedAt: connection.lastSyncedAt?.toISOString() ?? null,
          lastSyncError: connection.lastSyncError ?? null,
        }}
        isUsingDefaults={connection.isDefault}
      />
    </div>
  )
}
