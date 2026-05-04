import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { assertProjectAccess } from '@/lib/project'

export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id as string | undefined
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const icp = await prisma.iCP.findUnique({ where: { id: params.id } })
  if (!icp) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const ok = await assertProjectAccess(userId, icp.projectId)
  if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const links = await prisma.iCPTag.findMany({
    where: { icpId: params.id },
    include: { tag: true },
    orderBy: [{ tag: { name: 'asc' } }],
  })

  const tags = links.map((l) => ({
    id: l.tag.id,
    name: l.tag.name,
    color: l.tag.color,
    createdAt: l.tag.createdAt,
  }))

  return NextResponse.json({ tags })
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id as string | undefined
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const icp = await prisma.iCP.findUnique({ where: { id: params.id } })
  if (!icp) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const ok = await assertProjectAccess(userId, icp.projectId)
  if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const tagId = String(body?.tagId ?? '').trim()
  if (!tagId) return NextResponse.json({ error: 'tagId is required' }, { status: 400 })

  const tag = await prisma.tag.findUnique({ where: { id: tagId } })
  if (!tag || tag.projectId !== icp.projectId) {
    return NextResponse.json({ error: 'Tag not found in this project' }, { status: 404 })
  }

  await prisma.iCPTag.upsert({
    where: { icpId_tagId: { icpId: icp.id, tagId: tag.id } },
    create: { icpId: icp.id, tagId: tag.id },
    update: {},
  })

  return NextResponse.json({
    tag: { id: tag.id, name: tag.name, color: tag.color, createdAt: tag.createdAt },
  })
}
