import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getOrCreateCurrentProject } from '@/lib/project'
import { PageHeader } from '@/components/app/page-header'
import { RedFlagsClient } from './red-flags-client'

export const dynamic = 'force-dynamic'

export default async function RedFlagsPage() {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id as string
  const project = await getOrCreateCurrentProject(userId)

  const words = await prisma.redFlagWord.findMany({
    where: { projectId: project.id },
    orderBy: [{ category: 'asc' }, { word: 'asc' }],
  })

  return (
    <div className="max-w-[1100px] mx-auto">
      <PageHeader
        title="Red Flags Dictionary"
        description="Words and phrases the AI must avoid when generating content. Automatically injected into every brief."
      />
      <RedFlagsClient
        initialWords={words.map((w: any) => ({
          id: w.id,
          word: w.word,
          category: w.category,
          severity: w.severity,
          language: w.language,
          reason: w.reason ?? '',
        }))}
      />
    </div>
  )
}
