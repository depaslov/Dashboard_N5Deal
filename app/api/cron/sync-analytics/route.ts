import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { fetchGa4Summary } from '@/lib/analytics/ga4'
import { fetchGscSummary } from '@/lib/analytics/gsc'
import { fetchAhrefsSummary } from '@/lib/analytics/ahrefs'
import { singleDayRange, isoDate } from '@/lib/analytics/dates'

export const dynamic = 'force-dynamic'
// Vercel cron endpoints can run longer than default.
export const maxDuration = 300

// Runs daily; snapshots yesterday's numbers for every configured project.
// Auth: Vercel Cron sends `Authorization: Bearer <CRON_SECRET>` when the env var is set.
export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const connections = await prisma.analyticsConnection.findMany({
    where: {
      OR: [
        { ga4PropertyId: { not: null } },
        { gscSiteUrl: { not: null } },
        { ahrefsTarget: { not: null } },
      ],
    },
  })

  const results: any[] = []
  for (const conn of connections) {
    const projectId = conn.projectId
    const perProject: any = { projectId, ga4: null, gsc: null, ahrefs: null, error: null }
    try {
      // Snapshot yesterday for GA4; GSC data is finalized ~3 days later.
      const yesterday = offsetDays(new Date(), -1)
      const ga4Range = singleDayRange(yesterday)

      if (conn.ga4PropertyId) {
        const data = await fetchGa4Summary(conn.ga4PropertyId, ga4Range).catch((e) => {
          perProject.ga4 = { error: String(e?.message ?? e) }
          return null
        })
        if (data) {
          await upsertSnapshot(projectId, 'ga4', ga4Range.end, data)
          perProject.ga4 = 'ok'
        }
      }

      if (conn.gscSiteUrl) {
        const gscRange = singleDayRange(offsetDays(new Date(), -3))
        const data = await fetchGscSummary(conn.gscSiteUrl, gscRange).catch((e) => {
          perProject.gsc = { error: String(e?.message ?? e) }
          return null
        })
        if (data) {
          await upsertSnapshot(projectId, 'gsc', gscRange.end, data)
          perProject.gsc = 'ok'
        }
      }

      if (conn.ahrefsTarget) {
        const data = await fetchAhrefsSummary(conn.ahrefsTarget, (conn.ahrefsMode as any) ?? 'domain').catch(
          (e) => {
            perProject.ahrefs = { error: String(e?.message ?? e) }
            return null
          }
        )
        if (data) {
          await upsertSnapshot(projectId, 'ahrefs', isoDate(new Date()), data)
          perProject.ahrefs = 'ok'
        }
      }

      await prisma.analyticsConnection.update({
        where: { projectId },
        data: {
          lastSyncedAt: new Date(),
          lastSyncError:
            perProject.ga4?.error || perProject.gsc?.error || perProject.ahrefs?.error || null,
        },
      })
    } catch (err: any) {
      perProject.error = String(err?.message ?? err)
      await prisma.analyticsConnection
        .update({
          where: { projectId },
          data: { lastSyncedAt: new Date(), lastSyncError: perProject.error },
        })
        .catch(() => {})
    }
    results.push(perProject)
  }

  return NextResponse.json({ syncedAt: new Date().toISOString(), count: results.length, results })
}

async function upsertSnapshot(projectId: string, provider: string, dateStr: string, data: any) {
  const date = new Date(dateStr + 'T00:00:00Z')
  await prisma.analyticsSnapshot.upsert({
    where: { projectId_provider_date: { projectId, provider, date } },
    update: { data },
    create: { projectId, provider, date, data },
  })
}

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return true // if no secret configured, allow (self-hosted / local)
  const header = req.headers.get('authorization') ?? ''
  return header === `Bearer ${secret}`
}

function offsetDays(base: Date, days: number): Date {
  const d = new Date(base)
  d.setUTCDate(d.getUTCDate() + days)
  return d
}
