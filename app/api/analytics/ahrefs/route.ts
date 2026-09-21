import { NextResponse } from 'next/server'
import { fetchAhrefsSummary } from '@/lib/analytics/ahrefs'
import { memoize } from '@/lib/analytics/cache'
import { requireProjectAccess, isAccessError } from '@/lib/analytics/require-access'

export const dynamic = 'force-dynamic'

export async function GET() {
  const ctx = await requireProjectAccess()
  if (isAccessError(ctx)) return NextResponse.json({ error: ctx.error }, { status: ctx.status })
  if (!ctx.connection?.ahrefsTarget) {
    return NextResponse.json({ error: 'Ahrefs not configured', configured: false }, { status: 400 })
  }

  try {
    const mode = (ctx.connection.ahrefsMode as any) ?? 'domain'
    const data = await memoize(
      `ahrefs:${ctx.projectId}:${mode}:${ctx.connection.ahrefsTarget}`,
      6 * 60 * 60 * 1000, // 6h — Ahrefs data changes slowly and units cost money
      () => fetchAhrefsSummary(ctx.connection!.ahrefsTarget!, mode)
    )
    return NextResponse.json({ configured: true, data })
  } catch (err: any) {
    console.error('ahrefs fetch error', err)
    return NextResponse.json({ error: err?.message ?? 'Ahrefs fetch failed' }, { status: 500 })
  }
}
