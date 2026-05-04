// In-memory fixed-window rate limiter.
// NOTE: works only inside a single Node process. For serverless / multi-instance
// deployments, replace with Redis (e.g. @upstash/ratelimit) using the same shape.

type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()

export interface RateLimitResult {
  ok: boolean
  remaining: number
  retryAfterSec: number
}

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now()
  const existing = buckets.get(key)
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { ok: true, remaining: limit - 1, retryAfterSec: 0 }
  }
  if (existing.count >= limit) {
    return {
      ok: false,
      remaining: 0,
      retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    }
  }
  existing.count += 1
  return { ok: true, remaining: limit - existing.count, retryAfterSec: 0 }
}

export function getClientIp(req: Request | { headers: Headers } | null | undefined): string {
  if (!req) return 'unknown'
  const headers = (req as any).headers as Headers | undefined
  if (!headers) return 'unknown'
  const fwd = headers.get?.('x-forwarded-for') ?? ''
  const ip = fwd.split(',')[0]?.trim()
  if (ip) return ip
  return headers.get?.('x-real-ip') ?? 'unknown'
}
