import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getOrCreateCurrentProject } from '@/lib/project'
import { PageHeader } from '@/components/app/page-header'
import { SettingsClient } from './settings-client'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id as string
  const project = await getOrCreateCurrentProject(userId)

  const members = await prisma.projectMember.findMany({
    where: { projectId: project.id },
    include: { user: true },
    orderBy: { createdAt: 'asc' },
  })

  const myMembership = members.find((m: any) => m.userId === userId)

  return (
    <div className="max-w-[1000px] mx-auto">
      <PageHeader
        title="Settings"
        description="Manage your profile, current workspace and team members."
      />
      <SettingsClient
        user={{
          id: userId,
          name: session?.user?.name ?? '',
          email: session?.user?.email ?? '',
        }}
        project={{
          id: project.id,
          name: project.name,
          companyName: project.companyName,
          description: project.description ?? '',
          obsidianVaultPath: project.obsidianVaultPath ?? '',
        }}
        myRole={myMembership?.role ?? 'member'}
        members={members.map((m: any) => ({
          id: m.id,
          userId: m.userId,
          role: m.role,
          name: m?.user?.name ?? '',
          email: m?.user?.email ?? '',
          createdAt: m.createdAt.toISOString(),
        }))}
      />
    </div>
  )
}
