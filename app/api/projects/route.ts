import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id as string | undefined
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const memberships = await prisma.projectMember.findMany({
    where: { userId },
    include: { project: true },
    orderBy: { createdAt: 'asc' },
  })
  return NextResponse.json({
    projects: memberships.map((m: any) => ({
      id: m.project.id,
      name: m.project.name,
      companyName: m.project.companyName,
      description: m.project.description,
      memberRole: m.role,
    })),
  })
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id as string | undefined
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const name = String(body?.name ?? '').trim()
    const companyName = String(body?.companyName ?? '').trim()
    const description = body?.description ? String(body.description) : null

    if (!name || !companyName) {
      return NextResponse.json({ error: 'Name and company are required' }, { status: 400 })
    }

    const project = await prisma.project.create({
      data: { name, companyName, description, ownerId: userId },
    })
    await prisma.projectMember.create({
      data: { projectId: project.id, userId, role: 'admin' },
    })
    return NextResponse.json({ project })
  } catch (err) {
    console.error('create project error', err)
    return NextResponse.json({ error: 'Could not create project' }, { status: 500 })
  }
}
