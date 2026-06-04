import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { assertProjectAccess } from '@/lib/project'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// POST /api/content/[id]/duplicate — clone a GeneratedContent row into a new
// draft. Used when the operator wants a copy to iterate on without disturbing
// the original. Skips annotations on purpose (they're anchored to specific
// text positions in the source and would either match by accident on the
// copy or drift the moment the copy is edited).
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id as string | undefined
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const original = await prisma.generatedContent.findUnique({
    where: { id: params.id },
    include: { icps: { select: { icpId: true } } },
  })
  if (!original) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const ok = await assertProjectAccess(userId, original.projectId)
  if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Prefix the topic with "Copy of" so the operator can spot it in the list.
  // Avoid stacking "Copy of Copy of Copy of …" on repeat duplications by
  // collapsing the chain to a single prefix + a counter when re-duplicating.
  const baseTopic = original.topic.replace(/^(Copy(?:\s*\((?:\d+)\))?\s+of\s+)+/i, '')
  let topic = `Copy of ${baseTopic}`
  // If a copy with this exact topic already exists, append a (2), (3) …
  // suffix so the operator gets a unique entry in the list.
  const existing = await prisma.generatedContent.findFirst({
    where: { projectId: original.projectId, topic },
    select: { id: true },
  })
  if (existing) {
    let suffix = 2
    while (true) {
      const candidate = `Copy (${suffix}) of ${baseTopic}`
      const dup = await prisma.generatedContent.findFirst({
        where: { projectId: original.projectId, topic: candidate },
        select: { id: true },
      })
      if (!dup) { topic = candidate; break }
      suffix++
      if (suffix > 50) break // sanity guard
    }
  }

  // Re-attach the same set of ICPs via the join table so the copy carries
  // the same audience targeting forward. nestedCreates inside the same
  // transaction so partial state can't leak if the join fails.
  const copy = await prisma.generatedContent.create({
    data: {
      projectId: original.projectId,
      createdById: userId, // the operator who clicked Duplicate owns the copy
      contentType: original.contentType,
      topic,
      targetAudience: original.targetAudience,
      keyMessages: original.keyMessages,
      tone: original.tone,
      generatedBrief: original.generatedBrief,
      briefData: original.briefData ?? undefined,
      folderId: original.folderId,
      notes: original.notes, // carry the freeform notes; annotations are skipped
      icps: original.icps.length
        ? { create: original.icps.map((i) => ({ icpId: i.icpId })) }
        : undefined,
    },
    select: { id: true },
  })

  return NextResponse.json({ id: copy.id, topic })
}
