import { JWT } from 'google-auth-library'

let cachedCredentials: any | null = null

function loadServiceAccount(): any {
  if (cachedCredentials) return cachedCredentials

  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (!raw) {
    throw new Error(
      'GOOGLE_SERVICE_ACCOUNT_JSON env var is not set. Paste the service account JSON (raw or base64) into your .env.'
    )
  }

  let jsonText = raw.trim()
  // Accept base64-encoded values too (handy for Vercel single-line env vars).
  if (!jsonText.startsWith('{')) {
    try {
      jsonText = Buffer.from(jsonText, 'base64').toString('utf8')
    } catch (err) {
      throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is neither JSON nor valid base64')
    }
  }

  const parsed = JSON.parse(jsonText)
  if (!parsed.client_email || !parsed.private_key) {
    throw new Error('Service account JSON is missing client_email or private_key')
  }
  cachedCredentials = parsed
  return parsed
}

export function getServiceAccountEmail(): string {
  return loadServiceAccount().client_email
}

export function getJwtClient(scopes: string[]): JWT {
  const creds = loadServiceAccount()
  return new JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes,
  })
}

export function getServiceAccountCredentials() {
  return loadServiceAccount()
}
