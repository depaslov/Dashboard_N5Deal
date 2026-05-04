import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getOrCreateCurrentProject } from '@/lib/project'
import { exportProjectToObsidianVault } from '@/lib/obsidian-export'
import { UnsafeVaultPathError } from '@/lib/safe-path'
import { rateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id as string | undefined
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const limit = rateLimit(`obsidian-export:${userId}`, 5, 60_000)
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Too many export attempts. Please wait.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSec) } },
    )
  }

  try {
    const project = await getOrCreateCurrentProject(userId)
    const vaultPath = (project as any).obsidianVaultPath as string | undefined
    if (!vaultPath) {
      return NextResponse.json({ error: 'Obsidian vault path is not configured' }, { status: 400 })
    }

    const result = await exportProjectToObsidianVault(project.id, vaultPath)
    return NextResponse.json({ success: true, createdFiles: result.createdFiles })
  } catch (error: any) {
    if (error instanceof UnsafeVaultPathError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    console.error('Obsidian export error:', error)
    return NextResponse.json(
      { error: error?.message ?? 'Failed to export project to Obsidian' },
      { status: 500 },
    )
  }
}
