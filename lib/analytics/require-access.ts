import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getOrCreateCurrentProject } from '@/lib/project'

export type AccessCtx = {
  userId: string
  projectId: string
  role: string
  connection: {
    ga4PropertyId: string | null
    gscSiteUrl: string | null
    ahrefsTarget: string | null
    ahrefsMode: string
  } | null
}

export async function requireProjectAccess(): Promise<AccessCtx | { error: string; status: number }> {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id as string | undefined
  if (!userId) return { error: 'Unauthorized', status: 401 }

  const project = await getOrCreateCurrentProject(userId)
  const membership = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId: project.id, userId } },
  })
  if (!membership) return { error: 'Forbidden', status: 403 }

  const conn = await prisma.analyticsConnection.findUnique({ where: { projectId: project.id } })
  return {
    userId,
    projectId: project.id,
    role: membership.role,
    connection: conn
      ? {
          ga4PropertyId: conn.ga4PropertyId,
          gscSiteUrl: conn.gscSiteUrl,
          ahrefsTarget: conn.ahrefsTarget,
          ahrefsMode: conn.ahrefsMode,
        }
      : null,
  }
}

export function isAccessError(v: any): v is { error: string; status: number } {
  return v && typeof v.status === 'number' && typeof v.error === 'string'
}
