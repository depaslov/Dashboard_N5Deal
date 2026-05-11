import Link from 'next/link'
import { MARKETING_NAV } from '@/lib/marketing/constants'
import { MarketingTabs } from './marketing-tabs'

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-[1300px] mx-auto">
      <div className="flex items-baseline justify-between mb-2">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Marketing OS</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Content calendar, analytics reports, Q2 strategy, and brand cards — all in one place.
          </p>
        </div>
      </div>

      <MarketingTabs items={MARKETING_NAV as unknown as { slug: string; label: string; href: string }[]} />

      <div className="mt-6">{children}</div>
    </div>
  )
}
