type Entry<T> = { value: T; expiresAt: number }

const store = new Map<string, Entry<any>>()

export async function memoize<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const hit = store.get(key)
  const now = Date.now()
  if (hit && hit.expiresAt > now) return hit.value as T
  const value = await load()
  store.set(key, { value, expiresAt: now + ttlMs })
  return value
}

export function invalidatePrefix(prefix: string) {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key)
  }
}
