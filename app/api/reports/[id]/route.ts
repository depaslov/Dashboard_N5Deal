import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getOrCreateCurrentProject } from '@/lib/project'

export const dynamic = 'force-dynamic'

// Confirm the report exists AND belongs to the caller's current project.
async function ownedReport(userId: string, id: string) {
  const project = await getOrCreateCurrentProject(userId)
  const report = await prisma.operationalReport.findUnique({ where: { id } })
  if (!report || report.projectId !== project.id) return null
  return report
}

// PATCH — update title / period / subtitle / kind / bodyHtml.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id as string | undefined
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const existing = await ownedReport(userId, params.id)
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  const data: Record<string, unknown> = {}
  if (typeof body?.title === 'string') data.title = body.title.trim() || existing.title
  if (typeof body?.periodLabel === 'string') data.periodLabel = body.periodLabel.trim() || existing.periodLabel
  if (typeof body?.subtitle === 'string') data.subtitle = body.subtitle
  if (body?.kind === 'plan' || body?.kind === 'recap') data.kind = body.kind
  if (typeof body?.bodyHtml === 'string' && body.bodyHtml.length) data.bodyHtml = body.bodyHtml

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  const report = await prisma.operationalReport.update({ where: { id: params.id }, data })
  return NextResponse.json({ ok: true, report: { id: report.id, slug: report.slug } })
}

// DELETE — remove a report.
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id as string | undefined
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const existing = await ownedReport(userId, params.id)
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.operationalReport.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
