import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getOrCreateCurrentProject } from '@/lib/project'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id as string | undefined
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const project = await getOrCreateCurrentProject(userId)
  const contents = await prisma.generatedContent.findMany({
    where: { projectId: project.id },
    orderBy: { createdAt: 'desc' },
    include: {
      createdBy: true,
      icps: { include: { icp: { select: { id: true, name: true } } } },
    },
  })
  return NextResponse.json({ contents })
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id as string | undefined
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const contentType = String(body?.contentType ?? '').trim()
    const topic = String(body?.topic ?? '').trim()
    const targetAudience = String(body?.targetAudience ?? '').trim()
    const generatedBrief = String(body?.generatedBrief ?? '').trim()
    if (!contentType || !topic || !generatedBrief) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }
    const project = await getOrCreateCurrentProject(userId)
    const rawIcpIds: string[] = Array.isArray(body?.icpIds)
      ? body.icpIds.map((x: any) => String(x ?? '').trim()).filter(Boolean)
      : (body?.icpId ? [String(body.icpId).trim()].filter(Boolean) : [])
    const requestedIcpIds = Array.from(new Set(rawIcpIds))

    // Drop any ICPs that don't belong to this project — silently. The UI
    // shouldn't be sending those, but if it does we'd rather not crash.
    let validIcpIds: string[] = []
    if (requestedIcpIds.length > 0) {
      const icps = await prisma.iCP.findMany({
        where: { id: { in: requestedIcpIds }, projectId: project.id },
        select: { id: true },
      })
      validIcpIds = icps.map((i) => i.id)
    }

    const content = await prisma.generatedContent.create({
      data: {
        projectId: project.id,
        createdById: userId,
        contentType,
        topic,
        targetAudience,
        keyMessages: String(body?.keyMessages ?? ''),
        tone: String(body?.tone ?? ''),
        generatedBrief,
        briefData: body?.briefData ?? undefined,
        icps: validIcpIds.length > 0
          ? { create: validIcpIds.map((icpId) => ({ icpId })) }
          : undefined,
      },
      include: { icps: { include: { icp: { select: { id: true, name: true } } } } },
    })
    return NextResponse.json({ content })
  } catch (err) {
    console.error('save content error', err)
    return NextResponse.json({ error: 'Could not save brief' }, { status: 500 })
  }
}
