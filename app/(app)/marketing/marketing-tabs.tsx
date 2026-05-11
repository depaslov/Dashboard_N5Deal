'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

export function MarketingTabs({ items }: { items: { slug: string; label: string; href: string }[] }) {
  const pathname = usePathname() ?? ''
  return (
    <div className="border-b border-border">
      <nav className="flex gap-1 -mb-px overflow-x-auto" aria-label="Marketing sections">
        {items.map((item) => {
          const active =
            item.href === '/marketing'
              ? pathname === '/marketing'
              : pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.slug}
              href={item.href}
              className={cn(
                'inline-flex items-center px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
                active
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border',
              )}
            >
              {item.label}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
