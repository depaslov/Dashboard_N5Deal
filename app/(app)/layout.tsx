import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { getOrCreateCurrentProject, getUserProjects } from '@/lib/project'
import { DashboardShell } from '@/components/app/dashboard-shell'

export const dynamic = 'force-dynamic'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    redirect('/login')
  }
  const userId = session.user.id as string
  const currentProject = await getOrCreateCurrentProject(userId)
  const projects = await getUserProjects(userId)

  return (
    <DashboardShell
      user={{
        id: userId,
        name: session.user.name ?? 'User',
        email: session.user.email ?? '',
      }}
      currentProject={{
        id: currentProject.id,
        name: currentProject.name,
        companyName: currentProject.companyName,
      }}
      projects={projects.map((p: any) => ({
        id: p.id,
        name: p.name,
        companyName: p.companyName,
        memberRole: p.memberRole,
      }))}
    >
      {children}
    </DashboardShell>
  )
}
