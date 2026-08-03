import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getOrCreateCurrentProject } from '@/lib/project'

export const dynamic = 'force-dynamic'

function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  return base || 'report'
}

// POST — create a new operational report in the current project.
export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id as string | undefined
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const project = await getOrCreateCurrentProject(userId)
  const body = await req.json().catch(() => ({}))

  const title = String(body?.title ?? '').trim() || 'Новий звіт'
  const periodLabel = String(body?.periodLabel ?? '').trim() || 'Новий період'
  const subtitle = body?.subtitle ? String(body.subtitle) : null
  const kind = body?.kind === 'plan' ? 'plan' : 'recap'
  const bodyHtml =
    typeof body?.bodyHtml === 'string' && body.bodyHtml.length
      ? String(body.bodyHtml)
      : '<section class="mb-10"><h1 class="text-3xl font-bold mb-2">Новий звіт</h1><p class="text-sm text-muted-foreground">Натисніть «Редагувати», щоб додати вміст.</p></section>'

  // Unique slug within the project (append a counter on collision).
  const baseSlug = slugify(body?.slug ? String(body.slug) : title)
  let slug = baseSlug
  for (let i = 2; i < 100; i++) {
    const clash = await prisma.operationalReport.findUnique({
      where: { projectId_slug: { projectId: project.id, slug } },
      select: { id: true },
    })
    if (!clash) break
    slug = `${baseSlug}-${i}`
  }

  const report = await prisma.operationalReport.create({
    data: {
      projectId: project.id,
      slug,
      title,
      periodLabel,
      subtitle,
      kind,
      bodyHtml,
      // Newest on top by default.
      sortKey: new Date().toISOString(),
    },
  })

  return NextResponse.json({ report: { id: report.id, slug: report.slug } })
}
