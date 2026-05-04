import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function DELETE(_req: Request, { params }: { params: { id: string; memberId: string } }) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id as string | undefined
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId: params.id, userId } },
  })
  if (!admin || admin.role !== 'admin') {
    return NextResponse.json({ error: 'Only admins can remove members' }, { status: 403 })
  }

  const target = await prisma.projectMember.findUnique({ where: { id: params.memberId } })
  if (!target || target.projectId !== params.id) {
    return NextResponse.json({ error: 'Member not found' }, { status: 404 })
  }

  const project = await prisma.project.findUnique({ where: { id: params.id } })
  if (project?.ownerId === target.userId) {
    return NextResponse.json({ error: 'Cannot remove the workspace owner' }, { status: 400 })
  }

  await prisma.projectMember.delete({ where: { id: params.memberId } })
  return NextResponse.json({ ok: true })
}
