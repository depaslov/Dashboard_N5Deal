import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { assertProjectAccess } from '@/lib/project'

export const dynamic = 'force-dynamic'

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string; tagId: string } },
) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id as string | undefined
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const icp = await prisma.iCP.findUnique({ where: { id: params.id } })
  if (!icp) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const ok = await assertProjectAccess(userId, icp.projectId)
  if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const result = await prisma.iCPTag.deleteMany({
    where: { icpId: params.id, tagId: params.tagId },
  })
  if (result.count === 0) {
    return NextResponse.json({ error: 'Link not found' }, { status: 404 })
  }
  return NextResponse.json({ ok: true })
}
