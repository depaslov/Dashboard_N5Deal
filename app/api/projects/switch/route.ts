import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { assertProjectAccess, CURRENT_PROJECT_COOKIE } from '@/lib/project'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id as string | undefined
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const projectId = String(body?.projectId ?? '').trim()
  if (!projectId) {
    return NextResponse.json({ error: 'projectId is required' }, { status: 400 })
  }

  // Only let a user switch into a project they actually belong to.
  const hasAccess = await assertProjectAccess(userId, projectId)
  if (!hasAccess) {
    return NextResponse.json({ error: 'No access to that project' }, { status: 403 })
  }

  const res = NextResponse.json({ ok: true, projectId })
  res.cookies.set(CURRENT_PROJECT_COOKIE, projectId, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365, // 1 year
  })
  return res
}
