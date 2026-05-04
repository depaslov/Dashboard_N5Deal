import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id as string | undefined
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const body = await req.json()
    const name = String(body?.name ?? '').trim()
    if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    const user = await prisma.user.update({ where: { id: userId }, data: { name } })
    return NextResponse.json({ user: { id: user.id, name: user.name, email: user.email } })
  } catch (err) {
    console.error('update profile error', err)
    return NextResponse.json({ error: 'Could not update profile' }, { status: 500 })
  }
}
