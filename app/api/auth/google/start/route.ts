import { NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { buildAuthUrl, GoogleNotConfiguredError } from '@/lib/google/oauth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Kicks off the Google OAuth consent flow. We store a random state in a
// short-lived httpOnly cookie; the callback compares the cookie value to
// the state Google echoes back so the redirect can't be replayed by a
// third-party site (CSRF). The optional `?returnTo=` is the dashboard URL
// to send the operator back to once consent is done.
export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id as string | undefined
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const returnTo = url.searchParams.get('returnTo')

  let authUrl: string
  const state = randomBytes(16).toString('hex')
  try {
    authUrl = buildAuthUrl(state, returnTo)
  } catch (err) {
    if (err instanceof GoogleNotConfiguredError) {
      return NextResponse.json({ error: err.message }, { status: 503 })
    }
    throw err
  }

  const res = NextResponse.redirect(authUrl)
  res.cookies.set('g_oauth_state', state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 10, // 10 minutes — consent screens shouldn't take longer
  })
  return res
}
