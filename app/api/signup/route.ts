import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { SHARED_PROJECT_ID } from '@/lib/project'

export const dynamic = 'force-dynamic'

const BCRYPT_ROUNDS = 12
// bcrypt silently truncates passwords past 72 bytes — reject early.
const MAX_PASSWORD_BYTES = 72

const SignupSchema = z.object({
  email: z.string().email().max(254),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .refine(
      (p) => Buffer.byteLength(p, 'utf8') <= MAX_PASSWORD_BYTES,
      `Password must be at most ${MAX_PASSWORD_BYTES} bytes`,
    ),
  name: z.string().min(1).max(120),
})

// Pre-computed dummy bcrypt hash to keep timing roughly equal between the
// "email exists" and "new email" branches.
const DUMMY_HASH = '$2a$12$CwTycUXWue0Thq9StjUM0uJ8dG7y9Lh5/A5SkzYZP6eEzlNQ4dM6S'

export async function POST(req: Request) {
  const ip = getClientIp(req)
  const limit = rateLimit(`signup:${ip}`, 5, 60_000)
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Too many signup attempts. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSec) } },
    )
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = SignupSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid fields' },
      { status: 400 },
    )
  }

  const email = parsed.data.email.toLowerCase().trim()
  const password = parsed.data.password
  const name = parsed.data.name.trim()

  try {
    const existing = await prisma.user.findUnique({ where: { email } })

    if (existing) {
      // Anti-enumeration: do equivalent work and respond identically to the
      // "new account" path. Auto-signin from the client will then succeed only
      // if the password actually matches the existing account.
      await bcrypt.compare(password, DUMMY_HASH)
      return NextResponse.json({ ok: true })
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS)
    const user = await prisma.user.create({
      data: { email, passwordHash, name, role: 'user' },
    })

    // Single-tenant: every user joins the shared workspace and sees the same
    // ICPs, platforms, red flags, tags, prompts, and RAG knowledge base.
    await prisma.projectMember.create({
      data: { projectId: SHARED_PROJECT_ID, userId: user.id, role: 'member' },
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('signup error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
