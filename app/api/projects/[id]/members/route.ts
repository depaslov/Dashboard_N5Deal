import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id as string | undefined
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId: params.id, userId } },
  })
  if (!admin || admin.role !== 'admin') {
    return NextResponse.json({ error: 'Only admins can add members' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const email = String(body?.email ?? '').toLowerCase().trim()
    const role = String(body?.role ?? 'member') === 'admin' ? 'admin' : 'member'
    if (!email) return NextResponse.json({ error: 'Email is required' }, { status: 400 })

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      return NextResponse.json({ error: 'No account exists with that email. Ask them to sign up first.' }, { status: 404 })
    }

    const existing = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: params.id, userId: user.id } },
    })
    if (existing) {
      return NextResponse.json({ error: 'User is already a member' }, { status: 409 })
    }

    const member = await prisma.projectMember.create({
      data: { projectId: params.id, userId: user.id, role },
    })
    return NextResponse.json({ member })
  } catch (err) {
    console.error('add member error', err)
    return NextResponse.json({ error: 'Could not add member' }, { status: 500 })
  }
}
