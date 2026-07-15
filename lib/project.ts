import { cookies } from 'next/headers'
import { prisma } from '@/lib/db'

// Default project every user is auto-joined to on first load.
export const SHARED_PROJECT_ID = 'seed-project-n5deal'

// The adjacent BankStore AI project (seeded by scripts/seed-bankstore.ts). Its
// dashboard is trimmed down — Marketing OS collapses to just Tasks + Link Building.
export const BANKSTORE_PROJECT_ID = 'seed-project-bankstore'

// Cookie holding the user's currently-selected project. Set by
// POST /api/projects/switch and read here so every module (33 API routes +
// the app layout all funnel through getOrCreateCurrentProject) switches at once.
export const CURRENT_PROJECT_COOKIE = 'currentProjectId'

/**
 * Returns the user's currently-selected project.
 *
 * Resolution order:
 *   1. the project id in the `currentProjectId` cookie — only if the user is a
 *      member of it (guards against a stale/forged cookie);
 *   2. otherwise the shared default project, auto-joining the user.
 */
export async function getOrCreateCurrentProject(userId: string) {
  const selectedId = cookies().get(CURRENT_PROJECT_COOKIE)?.value
  if (selectedId && selectedId !== SHARED_PROJECT_ID) {
    const member = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: selectedId, userId } },
      include: { project: true },
    })
    if (member?.project) return member.project
  }

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
