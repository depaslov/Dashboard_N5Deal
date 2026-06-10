import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Reports whether the current user has a stored Google connection and the
// Google email it was issued for. Used by the "Open in Google Docs" buttons
// to decide between (a) sending the user through the OAuth consent flow vs
// (b) calling /docs/create directly.
//
// Also exposes whether the dashboard itself is configured (env vars set).
// The buttons hide themselves entirely if `configured` is false so we don't
// dangle a CTA that can't possibly work in the current environment.
export async function GET() {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id as string | undefined
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const configured = Boolean(
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GOOGLE_REDIRECT_URI,
  )
  if (!configured) {
    return NextResponse.json({ configured: false, connected: false })
  }

  const row = await prisma.googleAuthToken.findUnique({
    where: { userId },
    select: { googleEmail: true, createdAt: true },
  })
  return NextResponse.json({
    configured: true,
    connected: Boolean(row),
    googleEmail: row?.googleEmail ?? null,
    connectedAt: row?.createdAt?.toISOString() ?? null,
  })
}
