import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { assertProjectAccess } from '@/lib/project'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const BodySchema = z.object({
  action: z.enum(['accept', 'revert']),
})

// POST /api/content/[id]/regeneration
//   { action: 'accept' } → keep the regenerated brief, drop the snapshot.
//   { action: 'revert' } → restore the snapshot as the live brief and
//                          drop it from previousBrief.
//
// Either way, after this call previousBrief is null again and the diff UI
// goes away. The operator can re-run Regenerate-from-notes to start a new
// diff cycle.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id as string | undefined
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const content = await prisma.generatedContent.findUnique({
    where: { id: params.id },
    select: { id: true, projectId: true, generatedBrief: true, previousBrief: true },
  })
  if (!content) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const ok = await assertProjectAccess(userId, content.projectId)
  if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (!content.previousBrief) {
    return NextResponse.json(
      { error: 'No pending regeneration on this article — nothing to accept or revert.' },
      { status: 400 },
    )
  }

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid action' },
      { status: 400 },
    )
  }

  if (parsed.data.action === 'accept') {
    await prisma.generatedContent.update({
      where: { id: params.id },
      data: { previousBrief: null },
    })
    return NextResponse.json({ action: 'accept' })
  }

  // revert — copy previousBrief back into generatedBrief and clear the snapshot
  await prisma.generatedContent.update({
    where: { id: params.id },
    data: {
      generatedBrief: content.previousBrief,
      previousBrief: null,
    },
  })
  return NextResponse.json({ action: 'revert' })
}
