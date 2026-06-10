import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getOrCreateCurrentProject } from '@/lib/project'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Audit-trail feed for the Link Building module — the Activity tab pulls
// this. Returns the most recent N events (created / deleted / approved /
// unapproved) across the operator's project, newest first. Optional
// ?action=<created|deleted|approved|unapproved> and ?itemId=… filters so
// the same endpoint backs both the global feed and the per-task History
// drill-in (future work).
export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id as string | undefined
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const project = await getOrCreateCurrentProject(userId)
  const url = new URL(req.url)
  const action = url.searchParams.get('action') ?? undefined
  const itemId = url.searchParams.get('itemId') ?? undefined
  const limitRaw = Number(url.searchParams.get('limit') ?? '100')
  const limit = Math.min(Math.max(1, Number.isFinite(limitRaw) ? limitRaw : 100), 500)

  const events = await prisma.linkBuildingActivity.findMany({
    where: {
      projectId: project.id,
      ...(action ? { action } : {}),
      ...(itemId ? { itemId } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })
  return NextResponse.json({ events })
}
