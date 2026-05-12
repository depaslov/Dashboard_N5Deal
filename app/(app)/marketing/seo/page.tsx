import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getOrCreateCurrentProject } from '@/lib/project'
import { SeoBoard, type SeoKeywordRow } from './seo-board'

export const dynamic = 'force-dynamic'

export default async function MarketingSeoPage() {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id as string
  const project = await getOrCreateCurrentProject(userId)

  const keywords = await prisma.seoKeyword.findMany({
    where: { projectId: project.id },
    orderBy: [{ position: { sort: 'asc', nulls: 'last' } }, { keyword: 'asc' }],
  })

  const data: SeoKeywordRow[] = keywords.map((k) => ({
    id: k.id,
    keyword: k.keyword,
    targetUrl: k.targetUrl ?? '',
    currentUrl: k.currentUrl ?? '',
    position: k.position,
    previousPosition: k.previousPosition,
    impressions: k.impressions,
    clicks: k.clicks,
    volume: k.volume,
    difficulty: k.difficulty,
    cluster: k.cluster ?? '',
    intent: k.intent,
    locale: k.locale,
    isActive: k.isActive,
    notes: k.notes ?? '',
    lastChecked: k.lastChecked?.toISOString() ?? null,
  }))

  return <SeoBoard items={data} />
}
