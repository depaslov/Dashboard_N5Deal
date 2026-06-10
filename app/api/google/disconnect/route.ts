import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Forget the Google connection for the current user. We just drop our
// stored tokens — the user can also revoke our app from their Google
// account page if they want to invalidate the refresh token server-side.
export async function POST() {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id as string | undefined
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await prisma.googleAuthToken.deleteMany({ where: { userId } })
  return NextResponse.json({ ok: true })
}
