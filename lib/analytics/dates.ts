export type PeriodDays = 7 | 28 | 90

export function parsePeriod(input: string | number | null | undefined): PeriodDays {
  const n = typeof input === 'string' ? parseInt(input, 10) : input
  if (n === 7 || n === 28 || n === 90) return n
  return 28
}

export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

// Range excludes today (data is not final yet) — endDate is yesterday.
export function rangeForPeriod(period: PeriodDays, endDate: Date = new Date()): { start: string; end: string } {
  const end = new Date(endDate)
  end.setUTCHours(0, 0, 0, 0)
  end.setUTCDate(end.getUTCDate() - 1)
  const start = new Date(end)
  start.setUTCDate(start.getUTCDate() - (period - 1))
  return { start: isoDate(start), end: isoDate(end) }
}

// Single-day range for a specific date (used by cron snapshots).
export function singleDayRange(date: Date): { start: string; end: string } {
  const d = new Date(date)
  d.setUTCHours(0, 0, 0, 0)
  const s = isoDate(d)
  return { start: s, end: s }
}

// Previous comparable range immediately before the primary range.
export function previousRange(range: { start: string; end: string }): { start: string; end: string } {
  const start = new Date(range.start + 'T00:00:00Z')
  const end = new Date(range.end + 'T00:00:00Z')
  const days = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1
  const prevEnd = new Date(start)
  prevEnd.setUTCDate(prevEnd.getUTCDate() - 1)
  const prevStart = new Date(prevEnd)
  prevStart.setUTCDate(prevStart.getUTCDate() - (days - 1))
  return { start: isoDate(prevStart), end: isoDate(prevEnd) }
}
