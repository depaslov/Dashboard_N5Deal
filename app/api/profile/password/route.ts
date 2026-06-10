import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const BodySchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters').max(200),
})

// Self-change endpoint — operator updates their OWN password. We require
// the current password as proof so a hijacked session can't rotate the
// credential silently. Different from /api/users/[userId]/password which
// is the admin-side reset for OTHER teammates.
export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  const myId = session?.user?.id as string | undefined
  if (!myId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid fields' }, { status: 400 })
  }
  if (parsed.data.currentPassword === parsed.data.newPassword) {
    return NextResponse.json({ error: 'New password must be different from the current one.' }, { status: 400 })
  }

  const user = await prisma.user.findUnique({ where: { id: myId } })
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ok = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash)
  if (!ok) return NextResponse.json({ error: 'Current password is incorrect.' }, { status: 400 })

  const newHash = await bcrypt.hash(parsed.data.newPassword, 12)
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: newHash },
  })

  return NextResponse.json({ ok: true })
}
