import { NextResponse } from 'next/server'
import { CURRENT_PROJECT_COOKIE } from '@/lib/project'

export const dynamic = 'force-dynamic'

/**
 * Public endpoint: remembers which platform the visitor picked on the landing
 * page, before they sign in. It only stores the choice in a cookie — no data is
 * returned and nothing is trusted: getOrCreateCurrentProject re-validates
 * membership after login and falls back to the default project if the user
 * isn't actually a member. So an unauthenticated caller can't reach any data.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const projectId = String(body?.projectId ?? '').trim().slice(0, 100)
  if (!projectId) {
    return NextResponse.json({ error: 'projectId is required' }, { status: 400 })
  }

  const res = NextResponse.json({ ok: true })
  res.cookies.set(CURRENT_PROJECT_COOKIE, projectId, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  })
  return res
}
