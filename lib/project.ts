import { prisma } from '@/lib/db'

/**
 * Returns the first project the user owns or is a member of.
 * If user has no projects, creates a default one.
 */
export async function getOrCreateCurrentProject(userId: string) {
  // Try membership first
  const membership = await prisma.projectMember.findFirst({
    where: { userId },
    include: { project: true },
    orderBy: { createdAt: 'asc' },
  })
  if (membership?.project) return membership.project

  const owned = await prisma.project.findFirst({
    where: { ownerId: userId },
    orderBy: { createdAt: 'asc' },
  })
  if (owned) {
    // ensure membership row
    await prisma.projectMember.upsert({
      where: { projectId_userId: { projectId: owned.id, userId } },
      update: {},
      create: { projectId: owned.id, userId, role: 'admin' },
    })
    return owned
  }

  // Create a default workspace
  const user = await prisma.user.findUnique({ where: { id: userId } })
  const project = await prisma.project.create({
    data: {
      name: `${user?.name ?? 'My'} Workspace`,
      companyName: 'My Company',
      description: 'Default workspace',
      ownerId: userId,
    },
  })
  await prisma.projectMember.create({
    data: { projectId: project.id, userId, role: 'admin' },
  })
  return project
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
