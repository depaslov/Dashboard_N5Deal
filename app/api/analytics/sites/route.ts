import { NextResponse } from 'next/server'
import { listGscSites } from '@/lib/analytics/gsc'
import { getServiceAccountEmail } from '@/lib/analytics/google-auth'
import { requireProjectAccess, isAccessError } from '@/lib/analytics/require-access'

export const dynamic = 'force-dynamic'

// Helper endpoint for the settings UI — returns the list of GSC properties that
// the service account has access to, plus the SA email so admins can grant access.
export async function GET() {
  const ctx = await requireProjectAccess()
  if (isAccessError(ctx)) return NextResponse.json({ error: ctx.error }, { status: ctx.status })

  try {
    const [sites, email] = await Promise.all([
      listGscSites().catch((err) => ({ __error: String(err?.message ?? err) })),
      Promise.resolve(safeSaEmail()),
    ])
    return NextResponse.json({ sites, serviceAccountEmail: email })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Failed' }, { status: 500 })
  }
}

function safeSaEmail(): string | null {
  try {
    return getServiceAccountEmail()
  } catch {
    return null
  }
}
