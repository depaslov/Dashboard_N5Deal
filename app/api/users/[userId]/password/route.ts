import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const BodySchema = z.object({
  newPassword: z.string().min(8, 'Password must be at least 8 characters').max(200),
})

// Admin-only endpoint that sets ANY user's password directly. Built for
// the internal-tool case where the operator owns the DB anyway, so a full
// email-based reset flow is overkill: an admin in the workspace can punch
// in a new password for any teammate and read it back to them out-of-band.
//
// Authorisation: caller must (1) be signed in, (2) share at least one
// project with the target as an admin. We check this through ProjectMember
// rather than the global User.role flag because role on User is per-app
// (creator account) and the workspace authority lives on ProjectMember.
export async function POST(req: Request, { params }: { params: { userId: string } }) {
  const session = await getServerSession(authOptions)
  const myId = session?.user?.id as string | undefined
  if (!myId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (myId === params.userId) {
    // Self-change goes through /api/profile/password where we can require
    // the current password as proof. The admin route is for someone ELSE.
    return NextResponse.json({ error: 'Use /api/profile/password to change your own password.' }, { status: 400 })
  }

  const target = await prisma.user.findUnique({ where: { id: params.userId } })
  if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  // Caller must be admin in at least one project the target is a member
  // of — that proves they share workspace authority. We don't lean on the
  // global User.role because the workspace concept is per-project here.
  const sharedAdminProject = await prisma.projectMember.findFirst({
    where: {
      userId: myId,
      role: 'admin',
      project: {
        members: { some: { userId: target.id } },
      },
    },
  })
  if (!sharedAdminProject) {
    return NextResponse.json({ error: 'You need to be an admin in a shared workspace to reset this user\'s password.' }, { status: 403 })
  }

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid fields' }, { status: 400 })
  }

  const newHash = await bcrypt.hash(parsed.data.newPassword, 12)
  await prisma.user.update({
    where: { id: target.id },
    data: { passwordHash: newHash },
  })

  return NextResponse.json({ ok: true, email: target.email })
}
