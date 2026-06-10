import { Resend } from 'resend'

// Resend-based transactional email helper. Dashboard sends two kinds of
// email today (password reset + the reset confirmation), so the surface
// area is intentionally tiny. We instantiate Resend lazily so missing env
// vars don't crash unrelated routes — only callers that actually send
// email pay the cost.
//
// When RESEND_API_KEY is absent (typical for local dev or a fresh prod
// deploy before the operator has plumbed Resend), we fall back to logging
// the payload to the server console. That way the password-reset flow
// stays end-to-end usable: the operator can grab the reset URL out of
// `vercel logs` (or the dev terminal) and click it manually until they
// wire up real delivery.

interface SendEmailOptions {
  to: string
  subject: string
  html: string
  text: string
}

interface SendEmailResult {
  sent: boolean
  reason: 'sent' | 'no_api_key' | 'no_from' | 'error'
  error?: string
}

let _resend: Resend | null = null
function getResend(): Resend | null {
  if (_resend) return _resend
  const key = process.env.RESEND_API_KEY
  if (!key) return null
  _resend = new Resend(key)
  return _resend
}

export async function sendEmail(opts: SendEmailOptions): Promise<SendEmailResult> {
  const from = process.env.EMAIL_FROM
  const resend = getResend()

  if (!resend || !from) {
    // Dev / unconfigured fallback. Print the message so the operator can
    // recover the reset link from the logs without bouncing through
    // Resend setup just to test the flow.
    const reason = !resend ? 'no_api_key' : 'no_from'
    // eslint-disable-next-line no-console
    console.warn(
      `[email] ${reason} — falling back to console log instead of sending.\n` +
        `  TO:      ${opts.to}\n` +
        `  SUBJECT: ${opts.subject}\n` +
        `  TEXT:    ${opts.text}`,
    )
    return { sent: false, reason }
  }

  try {
    await resend.emails.send({
      from,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
    })
    return { sent: true, reason: 'sent' }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[email] send failed', err)
    return { sent: false, reason: 'error', error: (err as Error).message ?? 'unknown' }
  }
}
