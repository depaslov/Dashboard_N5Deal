import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Container healthcheck endpoint. Docker / docker-compose / Nginx upstream
// checks hit this to know "is the Next.js process actually serving traffic"
// — distinct from "is port 3000 listening", which can be true while the app
// is mid-startup or wedged. Returns immediately, no DB roundtrip, so a slow
// Neon link can't fail the container while the app itself is fine.
export async function GET() {
  return NextResponse.json({ ok: true, ts: new Date().toISOString() })
}
