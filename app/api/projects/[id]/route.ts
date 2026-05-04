import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { safeResolveVaultPath, UnsafeVaultPathError } from '@/lib/safe-path'

export const dynamic = 'force-dynamic'

async function getAdminMembership(userId: string, projectId: string) {
  return prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
  })
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id as string | undefined
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const membership = await getAdminMembership(userId, params.id)
  if (!membership || membership.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  let obsidianVaultPath: string | undefined
  if (body?.obsidianVaultPath != null) {
    const raw = String(body.obsidianVaultPath).trim()
    if (raw === '') {
      obsidianVaultPath = ''
    } else {
      try {
        // Validate up-front so a malicious path never lands in the DB.
        safeResolveVaultPath(raw)
        obsidianVaultPath = raw
      } catch (e) {
        const msg = e instanceof UnsafeVaultPathError ? e.message : 'Invalid vault path'
        return NextResponse.json({ error: msg }, { status: 400 })
      }
    }
  }

  try {
    const project = await prisma.project.update({
      where: { id: params.id },
      data: {
        name: String(body?.name ?? '').trim() || undefined,
        companyName: String(body?.companyName ?? '').trim() || undefined,
        description: body?.description ?? null,
        obsidianVaultPath,
      },
    })
    return NextResponse.json({ project })
  } catch (err) {
    console.error('update project error', err)
    return NextResponse.json({ error: 'Could not update project' }, { status: 500 })
  }
}
