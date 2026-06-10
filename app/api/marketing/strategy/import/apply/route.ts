import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getOrCreateCurrentProject } from '@/lib/project'
import {
  mergeAdditions, countAdditions,
  type StrategyAdditions, type StrategySnapshot,
} from '@/lib/marketing/strategy-merge'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// We accept ANY JSON object as the additions payload — Zod here just makes
// sure it's an object, not a string or array. The merge functions in
// strategy-merge.ts are defensive about missing/extra keys.
const BodySchema = z.object({
  additions: z.record(z.any()),
})

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id as string | undefined
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const project = await getOrCreateCurrentProject(userId)

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid fields' }, { status: 400 })
  }

  const additions = parsed.data.additions as StrategyAdditions
  const applied = countAdditions(additions)
  if (applied === 0) {
    return NextResponse.json({ ok: true, applied: 0 })
  }

  // Read the current strategy (or treat as empty when there's no row yet —
  // we create one in that case).
  const existing = await prisma.marketingStrategy.findUnique({ where: { projectId: project.id } })
  const currentSnapshot: StrategySnapshot = {
    budget: (existing?.budget as StrategySnapshot['budget']) ?? {},
    goals: (existing?.goals as StrategySnapshot['goals']) ?? {},
    channelDirectives: (existing?.channelDirectives as StrategySnapshot['channelDirectives']) ?? {},
    currentState: (existing?.currentState as StrategySnapshot['currentState']) ?? {},
    authorityLayer: (existing?.authorityLayer as StrategySnapshot['authorityLayer']) ?? {},
  }

  // mergeAdditions never overwrites — if a key the user ticked happens to
  // already exist (race with another tab editing), the merge silently
  // keeps the existing value. Final guarantee on top of the analyzer's
  // dedup gate.
  const merged = mergeAdditions(currentSnapshot, additions)

  await prisma.marketingStrategy.upsert({
    where: { projectId: project.id },
    create: {
      projectId: project.id,
      budget: merged.budget as object,
      goals: merged.goals as object,
      channelDirectives: merged.channelDirectives as object,
      currentState: merged.currentState as object,
      authorityLayer: merged.authorityLayer as object,
    },
    update: {
      budget: merged.budget as object,
      goals: merged.goals as object,
      channelDirectives: merged.channelDirectives as object,
      currentState: merged.currentState as object,
      authorityLayer: merged.authorityLayer as object,
    },
  })

  return NextResponse.json({ ok: true, applied })
}
