import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getOrCreateCurrentProject } from '@/lib/project'
import { syncObsidianVault } from '@/lib/obsidian-sync'
import { UnsafeVaultPathError } from '@/lib/safe-path'
import { embeddingsAvailable } from '@/lib/embeddings'
import { rateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id as string | undefined
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const limit = rateLimit(`obsidian-sync:${userId}`, 5, 60_000)
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Too many sync attempts. Please wait.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSec) } },
    )
  }

  if (!embeddingsAvailable()) {
    return NextResponse.json(
      { error: 'No embeddings provider is configured (set ABACUSAI_API_KEY or OPENAI_API_KEY).' },
      { status: 503 },
    )
  }

  try {
    const project = await getOrCreateCurrentProject(userId)
    const vaultPath = (project as any).obsidianVaultPath as string | undefined
    if (!vaultPath) {
      return NextResponse.json({ error: 'Obsidian vault path is not configured' }, { status: 400 })
    }

    const result = await syncObsidianVault(project.id, vaultPath)
    return NextResponse.json({ success: true, ...result })
  } catch (error: any) {
    if (error instanceof UnsafeVaultPathError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    console.error('Obsidian sync error:', error)
    return NextResponse.json(
      { error: error?.message ?? 'Failed to sync Obsidian vault' },
      { status: 500 },
    )
  }
}
