import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { invalidatePrefix } from '@/lib/analytics/cache'
import { requireProjectAccess, isAccessError } from '@/lib/analytics/require-access'

export const dynamic = 'force-dynamic'

export async function GET() {
  const ctx = await requireProjectAccess()
  if (isAccessError(ctx)) return NextResponse.json({ error: ctx.error }, { status: ctx.status })

  const conn = await prisma.analyticsConnection.findUnique({ where: { projectId: ctx.projectId } })
  return NextResponse.json({
    connection: conn ?? null,
    role: ctx.role,
  })
}

export async function PUT(req: Request) {
  const ctx = await requireProjectAccess()
  if (isAccessError(ctx)) return NextResponse.json({ error: ctx.error }, { status: ctx.status })
  if (ctx.role !== 'admin') return NextResponse.json({ error: 'Admins only' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const ga4PropertyId = normalize(body?.ga4PropertyId)
  const gscSiteUrl = normalize(body?.gscSiteUrl)
  const ahrefsTarget = normalize(body?.ahrefsTarget)
  const ahrefsMode = ['domain', 'subdomains', 'exact', 'prefix'].includes(body?.ahrefsMode)
    ? body.ahrefsMode
    : 'domain'

  const conn = await prisma.analyticsConnection.upsert({
    where: { projectId: ctx.projectId },
    update: { ga4PropertyId, gscSiteUrl, ahrefsTarget, ahrefsMode },
    create: {
      projectId: ctx.projectId,
      ga4PropertyId,
      gscSiteUrl,
      ahrefsTarget,
      ahrefsMode,
    },
  })

  // Invalidate cached responses so the UI refetches with the new config.
  invalidatePrefix(`ga4:${ctx.projectId}:`)
  invalidatePrefix(`gsc:${ctx.projectId}:`)
  invalidatePrefix(`ahrefs:${ctx.projectId}:`)

  return NextResponse.json({ connection: conn })
}

function normalize(v: any): string | null {
  if (v == null) return null
  const s = String(v).trim()
  return s.length ? s : null
}
