import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getOrCreateCurrentProject, BANKSTORE_PROJECT_ID } from '@/lib/project'
import { MARKETING_NAV } from '@/lib/marketing/constants'
import { MarketingTabs } from './marketing-tabs'

export const dynamic = 'force-dynamic'

// BankStore AI runs a trimmed Marketing OS — only the Tasks and Link Building boards.
const BANKSTORE_MARKETING_SLUGS = ['tasks', 'linkbuilding']

export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id as string
  const project = userId ? await getOrCreateCurrentProject(userId) : null
  const isBankstore = project?.id === BANKSTORE_PROJECT_ID

  const items = isBankstore
    ? MARKETING_NAV.filter((n) => BANKSTORE_MARKETING_SLUGS.includes(n.slug))
    : MARKETING_NAV

  return (
    <div className="max-w-[1300px] mx-auto">
      <div className="flex items-baseline justify-between mb-2">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">
            {isBankstore ? 'Tasks & Link Building' : 'Marketing OS'}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isBankstore
              ? 'Task board and link-building pipeline for BankStore AI.'
              : 'Content calendar, analytics reports, Q2 strategy, and brand cards — all in one place.'}
          </p>
        </div>
      </div>

      <MarketingTabs items={items as unknown as { slug: string; label: string; href: string }[]} />

      <div className="mt-6">{children}</div>
    </div>
  )
}
