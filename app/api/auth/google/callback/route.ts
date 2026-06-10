import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { exchangeCodeForTokens, fetchUserEmail } from '@/lib/google/oauth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Helper that turns "/marketing/reports?id=foo" into an absolute URL on the
// same origin as the incoming request. Used to redirect back to wherever
// the user kicked off the connect flow.
function safeReturnTo(req: Request, raw: string | null): string {
  if (!raw) return '/'
  try {
    // Only allow relative paths starting with "/" — never an off-site host.
    const decoded = decodeURIComponent(raw)
    if (!decoded.startsWith('/')) return '/'
    if (decoded.startsWith('//')) return '/'
    return new URL(decoded, req.url).toString()
  } catch {
    return '/'
  }
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id as string | undefined
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const stateRaw = url.searchParams.get('state') ?? ''
  const error = url.searchParams.get('error')

  // Pull the cookie we set in /start and clear it on the response so the
  // state can't be replayed. The state value is "<random>|<returnTo>".
  const cookieState = req.headers.get('cookie')?.match(/(?:^|;\s*)g_oauth_state=([^;]+)/)?.[1] ?? null
  const [statePart, returnToPart] = stateRaw.split('|')
  const returnTo = safeReturnTo(req, returnToPart ?? null)

  // Helper to clear the cookie on every response branch.
  const clearCookie = (res: NextResponse) => {
    res.cookies.set('g_oauth_state', '', { path: '/', maxAge: 0 })
    return res
  }

  if (error) {
    return clearCookie(
      NextResponse.redirect(new URL(`${returnTo}${returnTo.includes('?') ? '&' : '?'}g_oauth_error=${encodeURIComponent(error)}`, req.url)),
    )
  }
  if (!code || !statePart || !cookieState || statePart !== cookieState) {
    return clearCookie(
      NextResponse.redirect(new URL(`${returnTo}${returnTo.includes('?') ? '&' : '?'}g_oauth_error=state_mismatch`, req.url)),
    )
  }

  try {
    const tokens = await exchangeCodeForTokens(code)
    const email = await fetchUserEmail(tokens.accessToken)

    await prisma.googleAuthToken.upsert({
      where: { userId },
      create: {
        userId,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt,
        scope: tokens.scope,
        googleEmail: email,
      },
      update: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt,
        scope: tokens.scope,
        googleEmail: email,
      },
    })

    return clearCookie(
      NextResponse.redirect(new URL(`${returnTo}${returnTo.includes('?') ? '&' : '?'}g_oauth=ok`, req.url)),
    )
  } catch (err) {
    const msg = (err as Error).message ?? 'unknown_error'
    return clearCookie(
      NextResponse.redirect(new URL(`${returnTo}${returnTo.includes('?') ? '&' : '?'}g_oauth_error=${encodeURIComponent(msg.slice(0, 200))}`, req.url)),
    )
  }
}
