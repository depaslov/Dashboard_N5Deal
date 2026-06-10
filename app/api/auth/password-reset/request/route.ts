import { NextResponse } from 'next/server'
import { z } from 'zod'
import { randomBytes, createHash } from 'crypto'
import { prisma } from '@/lib/db'
import { sendEmail } from '@/lib/email'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const BodySchema = z.object({
  email: z.string().email().max(200),
})

// Build the absolute reset URL. Prefers NEXTAUTH_URL (already set on
// production for NextAuth), falls back to the request's own origin so the
// dev flow still works without extra config.
function buildResetUrl(req: Request, token: string): string {
  const base = process.env.NEXTAUTH_URL ?? new URL(req.url).origin
  return `${base.replace(/\/$/, '')}/reset-password?token=${encodeURIComponent(token)}`
}

function emailHtml(name: string, url: string): string {
  return `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;color:#111827;line-height:1.55;padding:24px;max-width:560px;margin:0 auto;">
  <h2 style="margin:0 0 12px 0;font-size:20px;">Reset your N5Deal Dashboard password</h2>
  <p>Hi ${name || 'there'},</p>
  <p>We received a request to reset the password for this email address. Click the button below to choose a new password. The link is valid for 60 minutes and can only be used once.</p>
  <p style="margin:24px 0;">
    <a href="${url}" style="display:inline-block;background:#111827;color:#fff;padding:10px 18px;text-decoration:none;border-radius:6px;font-weight:600;">Reset password</a>
  </p>
  <p style="font-size:13px;color:#6B7280;">If the button doesn't work, paste this link into your browser:<br/><a href="${url}" style="color:#2563EB;word-break:break-all;">${url}</a></p>
  <p style="font-size:13px;color:#6B7280;margin-top:24px;">If you didn't request this, you can safely ignore the email — your password won't change.</p>
</body></html>`
}

function emailText(name: string, url: string): string {
  return `Hi ${name || 'there'},

We received a request to reset the password for this email on the N5Deal Dashboard. Open the link below to choose a new password. The link is valid for 60 minutes and can only be used once.

${url}

If you didn't request this, you can safely ignore the email — your password won't change.`
}

export async function POST(req: Request) {
  // Rate-limit by IP so an attacker can't loop through every address in
  // the company directory. The legitimate flow only fires this endpoint
  // once per password-reset attempt, so 10/min is more than enough.
  const ip = getClientIp(req as any)
  const limit = rateLimit(`pwreset:request:${ip}`, 10, 60_000)
  if (!limit.ok) {
    return NextResponse.json({ ok: true }) // intentional white-lie — see below
  }

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid email' }, { status: 400 })
  }

  const email = parsed.data.email.toLowerCase().trim()
  const user = await prisma.user.findUnique({ where: { email } })

  // ALWAYS return success — even when the email doesn't match a user.
  // Otherwise the response code lets an attacker enumerate which emails
  // are registered. We do the real work (token + email) only when the
  // user exists, but the client can't tell either way.
  if (user) {
    // Cryptographically random token, 32 bytes → 64-char hex. Stored as
    // SHA-256 hash so a DB leak can't be turned into account takeover.
    const rawToken = randomBytes(32).toString('hex')
    const tokenHash = createHash('sha256').update(rawToken).digest('hex')
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 60 min

    // Invalidate any older outstanding tokens so the reset link in the
    // operator's inbox always points to the freshest issuance — solves
    // the "I clicked Forgot password twice and only the second link
    // works" confusion.
    await prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null, expiresAt: { gt: new Date() } },
      data: { usedAt: new Date() },
    })

    await prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash, expiresAt },
    })

    const url = buildResetUrl(req, rawToken)
    await sendEmail({
      to: email,
      subject: 'Reset your N5Deal Dashboard password',
      html: emailHtml(user.name, url),
      text: emailText(user.name, url),
    })
  }

  return NextResponse.json({ ok: true })
}
