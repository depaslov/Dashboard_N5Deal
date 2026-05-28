import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { assertProjectAccess } from '@/lib/project'

export const dynamic = 'force-dynamic'

const PatchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  color: z.string().max(32).nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
})

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id as string | undefined
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const folder = await prisma.contentFolder.findUnique({ where: { id: params.id } })
  if (!folder) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const ok = await assertProjectAccess(userId, folder.projectId)
  if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid fields' }, { status: 400 })
  }

  const data: any = {}
  if (parsed.data.name !== undefined) data.name = parsed.data.name.trim()
  if (parsed.data.color !== undefined) data.color = parsed.data.color
  if (parsed.data.sortOrder !== undefined) data.sortOrder = parsed.data.sortOrder

  try {
    const updated = await prisma.contentFolder.update({ where: { id: params.id }, data })
    return NextResponse.json({ folder: updated })
  } catch (err: any) {
    if (err?.code === 'P2002') {
      return NextResponse.json({ error: 'A folder with this name already exists' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Could not update folder' }, { status: 500 })
  }
}

// DELETE — removes the folder. Its content is NOT deleted; folderId is set
// null via the schema's onDelete: SetNull, so those items become uncategorised.
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id as string | undefined
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const folder = await prisma.contentFolder.findUnique({ where: { id: params.id } })
  if (!folder) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const ok = await assertProjectAccess(userId, folder.projectId)
  if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.contentFolder.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
