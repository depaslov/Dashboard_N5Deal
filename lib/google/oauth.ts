// Google OAuth + Drive API helpers used by the "Open in Google Docs" flow.
// We use the OAuth 2.0 web-application flow with offline access so we get a
// refresh token on first consent — the dashboard then never needs to ask
// again unless the user revokes access on their Google account page.
//
// Scope: drive.file — least privilege. The dashboard can create/read/update
// only files it itself created. It cannot read the user's personal Drive.

import { prisma } from '@/lib/db'

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo'

export const GOOGLE_SCOPE = 'https://www.googleapis.com/auth/drive.file openid email'

export class GoogleNotConfiguredError extends Error {
  constructor() {
    super('Google OAuth is not configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI on the server.')
    this.name = 'GoogleNotConfiguredError'
  }
}

export class GoogleNotConnectedError extends Error {
  constructor() {
    super('Google account is not connected for this user.')
    this.name = 'GoogleNotConnectedError'
  }
}

export function googleEnv(): { clientId: string; clientSecret: string; redirectUri: string } {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const redirectUri = process.env.GOOGLE_REDIRECT_URI
  if (!clientId || !clientSecret || !redirectUri) throw new GoogleNotConfiguredError()
  return { clientId, clientSecret, redirectUri }
}

// Build the consent URL the operator's browser is redirected to. State is
// random per request and validated by the callback; it doubles as CSRF
// protection. We ask for offline access + prompt=consent so we always get a
// refresh token even if the user has connected before (otherwise Google
// silently re-grants without one and the second auth attempt loses it).
export function buildAuthUrl(state: string, returnTo: string | null): string {
  const { clientId, redirectUri } = googleEnv()
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: GOOGLE_SCOPE,
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state: state + (returnTo ? `|${encodeURIComponent(returnTo)}` : ''),
  })
  return `${GOOGLE_AUTH_URL}?${params.toString()}`
}

// Exchange the one-time code from the consent redirect for access + refresh
// tokens. Refresh token only comes back on first consent (or when we force
// prompt=consent — which we do, see buildAuthUrl).
export async function exchangeCodeForTokens(code: string): Promise<{
  accessToken: string
  refreshToken: string
  expiresAt: Date
  scope: string
}> {
  const { clientId, clientSecret, redirectUri } = googleEnv()
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Google token exchange failed (${res.status}): ${body.slice(0, 300)}`)
  }
  const data = await res.json()
  if (!data.refresh_token) {
    throw new Error('Google did not return a refresh token. Try disconnecting + reconnecting.')
  }
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: new Date(Date.now() + (data.expires_in ?? 3600) * 1000),
    scope: data.scope ?? GOOGLE_SCOPE,
  }
}

// Use the refresh token to get a fresh access token. Stored access token is
// then updated in the DB by the caller.
async function refreshAccessToken(refreshToken: string): Promise<{
  accessToken: string
  expiresAt: Date
}> {
  const { clientId, clientSecret } = googleEnv()
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
    }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Google token refresh failed (${res.status}): ${body.slice(0, 300)}`)
  }
  const data = await res.json()
  return {
    accessToken: data.access_token,
    expiresAt: new Date(Date.now() + (data.expires_in ?? 3600) * 1000),
  }
}

// Fetch the Google user's email + id so we can show "Connected as ..." in
// the UI. Best-effort — failures don't break the auth flow.
export async function fetchUserEmail(accessToken: string): Promise<string | null> {
  try {
    const res = await fetch(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!res.ok) return null
    const data = await res.json()
    return typeof data?.email === 'string' ? data.email : null
  } catch {
    return null
  }
}

// Return a valid access token for the user, refreshing if needed. Throws
// GoogleNotConnectedError if the user has never connected. Throws if the
// refresh fails (e.g. the user revoked access from their Google account).
export async function getValidAccessToken(userId: string): Promise<string> {
  const row = await prisma.googleAuthToken.findUnique({ where: { userId } })
  if (!row) throw new GoogleNotConnectedError()

  // Refresh 60 s before nominal expiry so a slow request doesn't get caught
  // by token expiry mid-flight.
  if (row.expiresAt.getTime() - Date.now() > 60_000) {
    return row.accessToken
  }

  const refreshed = await refreshAccessToken(row.refreshToken)
  await prisma.googleAuthToken.update({
    where: { userId },
    data: { accessToken: refreshed.accessToken, expiresAt: refreshed.expiresAt },
  })
  return refreshed.accessToken
}

// Drive API: upload HTML, ask Drive to convert it to a Google Doc. Returns
// the new file's id + the canonical /document/d/{id}/edit URL.
//
// Drive's "multipart upload" endpoint takes a multipart/related body where:
//   - Part 1 (application/json): file metadata, including the TARGET mime
//     type "application/vnd.google-apps.document" (Google Doc).
//   - Part 2 (text/html): the actual HTML content. Drive converts the HTML
//     into Doc XML on the server when the target mime type is a Google
//     Workspace file type.
//
// We hand-build the multipart body because Node's fetch + FormData would
// pick application/x-www-form-urlencoded / multipart/form-data, but Drive
// requires the rarer multipart/related encoding.
export async function createGoogleDoc(
  accessToken: string,
  title: string,
  html: string,
): Promise<{ docId: string; docUrl: string }> {
  const boundary = '----n5deal-' + Math.random().toString(36).slice(2)
  const metadata = JSON.stringify({
    name: title,
    mimeType: 'application/vnd.google-apps.document',
  })
  const body =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${metadata}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: text/html; charset=UTF-8\r\n\r\n` +
    `${html}\r\n` +
    `--${boundary}--`

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    },
  )

  if (!res.ok) {
    const errBody = await res.text().catch(() => '')
    throw new Error(`Drive upload failed (${res.status}): ${errBody.slice(0, 400)}`)
  }
  const data = await res.json()
  if (!data?.id) throw new Error('Drive upload returned no file id.')
  return { docId: data.id, docUrl: `https://docs.google.com/document/d/${data.id}/edit` }
}
