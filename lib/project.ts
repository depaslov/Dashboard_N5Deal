import { prisma } from '@/lib/db'

// Single-tenant deployment: everyone shares this project.
export const SHARED_PROJECT_ID = 'seed-project-n5deal'

/**
 * Returns the shared project. If the user isn't a member yet, joins them.
 */
export async function getOrCreateCurrentProject(userId: string) {
  const shared = await prisma.project.findUnique({ where: { id: SHARED_PROJECT_ID } })
  if (!shared) {
    throw new Error(
      `Shared project "${SHARED_PROJECT_ID}" not found — run scripts/safe-seed.ts to create it.`,
    )
  }

  await prisma.projectMember.upsert({
    where: { projectId_userId: { projectId: SHARED_PROJECT_ID, userId } },
    update: {},
    create: { projectId: SHARED_PROJECT_ID, userId, role: 'member' },
  })

  return shared
}

export async function getUserProjects(userId: string) {
  const memberships = await prisma.projectMember.findMany({
    where: { userId },
    include: { project: true },
    orderBy: { createdAt: 'asc' },
  })
  return memberships.map((m: any) => ({ ...m.project, memberRole: m.role }))
}

export async function assertProjectAccess(userId: string, projectId: string) {
  const member = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
  })
  return !!member
}
