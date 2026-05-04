import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { assertProjectAccess } from '@/lib/project'

export const dynamic = 'force-dynamic'

async function getIcpOrNull(userId: string, id: string) {
  const icp = await prisma.iCP.findUnique({ where: { id } })
  if (!icp) return null
  const ok = await assertProjectAccess(userId, icp.projectId)
  return ok ? icp : null
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id as string | undefined
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const icp = await getIcpOrNull(userId, params.id)
  if (!icp) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ icp })
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id as string | undefined
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const existing = await getIcpOrNull(userId, params.id)
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  try {
    const body = await req.json()
    const icp = await prisma.iCP.update({
      where: { id: params.id },
      data: {
        name: String(body?.name ?? existing.name),
        industry: String(body?.industry ?? existing.industry),
        companySize: String(body?.companySize ?? existing.companySize),
        painPoints: Array.isArray(body?.painPoints) ? body.painPoints.map((x: any) => String(x)) : existing.painPoints,
        goals: Array.isArray(body?.goals) ? body.goals.map((x: any) => String(x)) : existing.goals,
        demographics: String(body?.demographics ?? existing.demographics),
        budgetRange: String(body?.budgetRange ?? existing.budgetRange),
        decisionProcess: String(body?.decisionProcess ?? existing.decisionProcess),
      },
    })
    return NextResponse.json({ icp })
  } catch (err) {
    console.error('update icp error', err)
    return NextResponse.json({ error: 'Could not update ICP' }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id as string | undefined
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const existing = await getIcpOrNull(userId, params.id)
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.iCP.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
