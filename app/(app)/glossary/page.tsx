import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getOrCreateCurrentProject } from '@/lib/project'
import { PageHeader } from '@/components/app/page-header'
import { GlossaryClient } from './glossary-client'

export const dynamic = 'force-dynamic'

export default async function GlossaryPage() {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id as string
  const project = await getOrCreateCurrentProject(userId)

  const entries = await prisma.glossaryEntry.findMany({
    where: { projectId: project.id },
    orderBy: [{ language: 'asc' }, { phrase: 'asc' }],
  })

  return (
    <div className="max-w-[1100px] mx-auto">
      <PageHeader
        title="Glossary"
        description="Phrase + definition pairs for the public /glossary page. Two-column table — add, edit, delete, or bulk-import entries."
      />
      <GlossaryClient
        initialEntries={entries.map((e) => ({
          id: e.id,
          phrase: e.phrase,
          definition: e.definition,
          slug: e.slug,
          language: e.language,
        }))}
      />
    </div>
  )
}
