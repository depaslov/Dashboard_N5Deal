import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getOrCreateCurrentProject } from '@/lib/project'

export const dynamic = 'force-dynamic'

const PatchSchema = z.object({
  activeBudgetMonth: z.enum(['april', 'may', 'june']).optional(),
  budget: z.record(z.string(), z.any()).optional(),
  goals: z.record(z.string(), z.any()).optional(),
  channelDirectives: z.record(z.string(), z.any()).optional(),
})

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id as string | undefined
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const project = await getOrCreateCurrentProject(userId)

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid fields' },
      { status: 400 },
    )
  }
  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  const strategy = await prisma.marketingStrategy.upsert({
    where: { projectId: project.id },
    create: { projectId: project.id, ...parsed.data },
    update: parsed.data,
  })
  return NextResponse.json({ strategy })
}
