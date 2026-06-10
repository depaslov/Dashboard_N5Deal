import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createHash } from 'crypto'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const BodySchema = z.object({
  token: z.string().min(32).max(200),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(200),
})

export async function POST(req: Request) {
  // Same rate limit category as request — bursts of guesses (whether
  // they're guessing tokens or just hammering the endpoint) shouldn't be
  // possible from one IP.
  const ip = getClientIp(req as any)
  const limit = rateLimit(`pwreset:confirm:${ip}`, 20, 60_000)
  if (!limit.ok) {
    return NextResponse.json({ error: 'Too many attempts. Try again in a minute.' }, { status: 429 })
  }

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid fields' }, { status: 400 })
  }

  // We stored the SHA-256 of the token, not the token itself, so the
  // unique-lookup happens against the hash. Constant-time comparison via
  // unique index — the DB either finds the row or doesn't.
  const tokenHash = createHash('sha256').update(parsed.data.token).digest('hex')
  const row = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  })

  if (!row) {
    return NextResponse.json({ error: 'This reset link is invalid. Request a new one.' }, { status: 400 })
  }
  if (row.usedAt) {
    return NextResponse.json({ error: 'This reset link has already been used. Request a new one if you need to change your password again.' }, { status: 400 })
  }
  if (row.expiresAt.getTime() < Date.now()) {
    return NextResponse.json({ error: 'This reset link has expired. Request a new one.' }, { status: 400 })
  }

  // Atomic-ish: mark the token used in the same transaction as the
  // password update, so a crash mid-flight either leaves the token
  // valid (operator can retry) or finishes both writes. Without the
  // transaction we'd have a small window where the password is updated
  // but the token is still marked unused.
  const newHash = await bcrypt.hash(parsed.data.password, 12)
  await prisma.$transaction([
    prisma.user.update({
      where: { id: row.userId },
      data: { passwordHash: newHash },
    }),
    prisma.passwordResetToken.update({
      where: { id: row.id },
      data: { usedAt: new Date() },
    }),
    // Also burn any OTHER pending reset tokens for this user — once they
    // reset, every outstanding link should stop working.
    prisma.passwordResetToken.updateMany({
      where: { userId: row.userId, usedAt: null, id: { not: row.id } },
      data: { usedAt: new Date() },
    }),
  ])

  return NextResponse.json({ ok: true, email: row.user.email })
}
