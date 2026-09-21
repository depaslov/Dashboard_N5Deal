import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getOrCreateCurrentProject } from '@/lib/project'
import { getEffectiveConnection } from '@/lib/analytics/require-access'
import { PageHeader } from '@/components/app/page-header'
import { AnalyticsClient } from './analytics-client'

export const dynamic = 'force-dynamic'

export default async function AnalyticsPage() {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id as string
  const project = await getOrCreateCurrentProject(userId)

  const connection = await getEffectiveConnection(project.id)

  return (
    <div className="max-w-[1400px] mx-auto">
      <PageHeader
        title="Analytics"
        description={`Traffic, search and backlink metrics for ${project.name}.`}
      />
      <AnalyticsClient
        connection={{
          ga4Configured: !!connection.ga4PropertyId,
          gscConfigured: !!connection.gscSiteUrl,
          ahrefsConfigured: !!connection.ahrefsTarget,
        }}
      />
    </div>
  )
}
