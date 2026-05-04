import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getOrCreateCurrentProject } from '@/lib/project'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id as string | undefined
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const project = await getOrCreateCurrentProject(userId)
  const icps = await prisma.iCP.findMany({
    where: { projectId: project.id },
    orderBy: { updatedAt: 'desc' },
  })
  return NextResponse.json({ icps })
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id as string | undefined
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const name = String(body?.name ?? '').trim()
    const industry = String(body?.industry ?? '').trim()
    if (!name || !industry) {
      return NextResponse.json({ error: 'Name and industry are required' }, { status: 400 })
    }
    const project = await getOrCreateCurrentProject(userId)
    const icp = await prisma.iCP.create({
      data: {
        projectId: project.id,
        name,
        industry,
        companySize: String(body?.companySize ?? '').trim(),
        painPoints: Array.isArray(body?.painPoints) ? body.painPoints.map((x: any) => String(x)) : [],
        goals: Array.isArray(body?.goals) ? body.goals.map((x: any) => String(x)) : [],
        demographics: String(body?.demographics ?? '').trim(),
        budgetRange: String(body?.budgetRange ?? '').trim(),
        decisionProcess: String(body?.decisionProcess ?? '').trim(),
      },
    })
    return NextResponse.json({ icp })
  } catch (err) {
    console.error('create icp error', err)
    return NextResponse.json({ error: 'Could not create ICP' }, { status: 500 })
  }
}
