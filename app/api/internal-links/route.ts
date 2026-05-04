import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getOrCreateCurrentProject } from '@/lib/project'

export const dynamic = 'force-dynamic'

const VALID_PRIORITIES = ['must', 'nice']

function coerceAnchorAlts(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw.map((s) => String(s ?? '').trim()).filter(Boolean)
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id as string | undefined
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const project = await getOrCreateCurrentProject(userId)
  const { searchParams } = new URL(req.url)
  const category = searchParams.get('category') || undefined
  const includeInactive = searchParams.get('includeInactive') === 'true'

  const links = await prisma.internalLink.findMany({
    where: {
      projectId: project.id,
      ...(category ? { category } : {}),
      ...(includeInactive ? {} : { isActive: true }),
    },
    orderBy: [{ category: 'asc' }, { url: 'asc' }],
  })
  return NextResponse.json({ links })
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id as string | undefined
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const project = await getOrCreateCurrentProject(userId)

  // Bulk mode: { links: [...] }
  if (Array.isArray(body?.links)) {
    const items = body.links
      .map((l: any) => ({
        url: String(l?.url ?? '').trim(),
        anchor: String(l?.anchor ?? '').trim(),
        anchorAlts: coerceAnchorAlts(l?.anchorAlts),
        context: l?.context ? String(l.context).trim() : null,
        category: l?.category ? String(l.category).trim() : null,
        priority: VALID_PRIORITIES.includes(l?.priority) ? l.priority : 'nice',
        isActive: l?.isActive === false ? false : true,
      }))
      .filter((l: any) => l.url.length > 0 && l.anchor.length > 0)

    if (items.length === 0) {
      return NextResponse.json({ error: 'No valid links provided' }, { status: 400 })
    }

    const results = await Promise.all(
      items.map((item: any) =>
        prisma.internalLink.upsert({
          where: { projectId_url: { projectId: project.id, url: item.url } },
          update: {
            anchor: item.anchor,
            anchorAlts: item.anchorAlts,
            context: item.context,
            category: item.category,
            priority: item.priority,
            isActive: item.isActive,
          },
          create: { ...item, projectId: project.id },
        })
      )
    )
    return NextResponse.json({ links: results, created: results.length })
  }

  // Single mode
  const url = String(body?.url ?? '').trim()
  const anchor = String(body?.anchor ?? '').trim()
  if (!url) return NextResponse.json({ error: 'URL is required' }, { status: 400 })
  if (!anchor) return NextResponse.json({ error: 'Anchor is required' }, { status: 400 })

  const priority = VALID_PRIORITIES.includes(body?.priority) ? body.priority : 'nice'
  const anchorAlts = coerceAnchorAlts(body?.anchorAlts)
  const context = body?.context ? String(body.context).trim() : null
  const category = body?.category ? String(body.category).trim() : null
  const isActive = body?.isActive === false ? false : true

  try {
    const created = await prisma.internalLink.upsert({
      where: { projectId_url: { projectId: project.id, url } },
      update: { anchor, anchorAlts, context, category, priority, isActive },
      create: { projectId: project.id, url, anchor, anchorAlts, context, category, priority, isActive },
    })
    return NextResponse.json({ link: created })
  } catch (err) {
    console.error('internal-link create error', err)
    return NextResponse.json({ error: 'Could not save internal link' }, { status: 500 })
  }
}
