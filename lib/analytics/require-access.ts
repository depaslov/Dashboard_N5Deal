import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getOrCreateCurrentProject } from '@/lib/project'

// Fallback targets used when a project has no AnalyticsConnection row yet.
// This lets the dashboard show real data out of the box — no clicking through
// /settings/integrations required. Once someone saves a custom target it wins
// over the default (and the row is created).
export const DEFAULT_CONNECTION = {
  ga4PropertyId: '515703727',
  gscSiteUrl: 'sc-domain:n5deal.com',
  ahrefsTarget: 'n5deal.com',
  ahrefsMode: 'domain',
}

export type EffectiveConnection = {
  ga4PropertyId: string | null
  gscSiteUrl: string | null
  ahrefsTarget: string | null
  ahrefsMode: string
  lastSyncedAt: Date | null
  lastSyncError: string | null
  isDefault: boolean
}

export async function getEffectiveConnection(projectId: string): Promise<EffectiveConnection> {
  const row = await prisma.analyticsConnection.findUnique({ where: { projectId } })
  if (row) {
    return {
      ga4PropertyId: row.ga4PropertyId ?? DEFAULT_CONNECTION.ga4PropertyId,
      gscSiteUrl: row.gscSiteUrl ?? DEFAULT_CONNECTION.gscSiteUrl,
      ahrefsTarget: row.ahrefsTarget ?? DEFAULT_CONNECTION.ahrefsTarget,
      ahrefsMode: row.ahrefsMode ?? DEFAULT_CONNECTION.ahrefsMode,
      lastSyncedAt: row.lastSyncedAt,
      lastSyncError: row.lastSyncError,
      isDefault: false,
    }
  }
  return {
    ga4PropertyId: DEFAULT_CONNECTION.ga4PropertyId,
    gscSiteUrl: DEFAULT_CONNECTION.gscSiteUrl,
    ahrefsTarget: DEFAULT_CONNECTION.ahrefsTarget,
    ahrefsMode: DEFAULT_CONNECTION.ahrefsMode,
    lastSyncedAt: null,
    lastSyncError: null,
    isDefault: true,
  }
}

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

  const eff = await getEffectiveConnection(project.id)
  return {
    userId,
    projectId: project.id,
    role: membership.role,
    connection: {
      ga4PropertyId: eff.ga4PropertyId,
      gscSiteUrl: eff.gscSiteUrl,
      ahrefsTarget: eff.ahrefsTarget,
      ahrefsMode: eff.ahrefsMode,
    },
  }
}

export function isAccessError(v: any): v is { error: string; status: number } {
  return v && typeof v.status === 'number' && typeof v.error === 'string'
}
