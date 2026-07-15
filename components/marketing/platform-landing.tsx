'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ArrowRight, Sparkles } from 'lucide-react'

interface PlatformDef {
  id: string
  badge: string
  name: string
  primary: string // HSL triple → --primary
  accent: string // HSL triple → --accent (highlighted word + tag)
  tag: string
  headline: { pre: string; highlight: string; post: string }
  desc: string
}

// The two platforms mirror the seeded projects (seed.ts / seed-bankstore.ts).
// Kept here so the public landing can re-skin without exposing the DB pre-auth.
const PLATFORMS: PlatformDef[] = [
  {
    id: 'seed-project-n5deal',
    badge: 'N5',
    name: 'N5Deal',
    primary: '222 47% 15%',
    accent: '217 91% 51%',
    tag: 'AI-powered marketing brain',
    headline: { pre: 'The centralized ', highlight: 'AI brain', post: ' for ICP-driven content at scale.' },
    desc: 'Manage ideal customer profiles, generate structured content briefs across LinkedIn, articles, catalogs and Telegram, and collaborate with your marketing team — all in one clean workspace.',
  },
  {
    id: 'seed-project-bankstore',
    badge: 'BS',
    name: 'BankStore AI',
    primary: '168 76% 26%',
    accent: '168 76% 38%',
    tag: 'AI-powered commerce brain',
    headline: { pre: 'The ', highlight: 'AI storefront', post: ' brain for smarter commerce at scale.' },
    desc: 'Manage products and campaigns, generate store content and marketing across every channel, and collaborate with your team — all in one BankStore AI workspace.',
  },
]

export function PlatformLanding() {
  const router = useRouter()
  const [selectedId, setSelectedId] = useState(PLATFORMS[0].id)
  const [pending, setPending] = useState<string | null>(null)
  const platform = PLATFORMS.find((p) => p.id === selectedId) ?? PLATFORMS[0]

  const brandStyle = {
    ['--primary' as any]: platform.primary,
    ['--accent' as any]: platform.accent,
  } as React.CSSProperties

  // Remember the picked platform, then head into the app. After login,
  // getOrCreateCurrentProject reads the cookie and lands the user here.
  const go = async (href: string) => {
    setPending(href)
    try {
      await fetch('/api/platform-preference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: selectedId }),
      }).catch(() => {})
      router.push(href)
    } finally {
      setPending(null)
    }
  }

  return (
    <div style={brandStyle}>
      {/* Header */}
      <header className="sticky top-0 z-40 w-full border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center bg-primary text-primary-foreground font-display font-bold text-sm">
              {platform.badge}
            </div>
            <span className="font-display font-semibold text-lg tracking-tight">{platform.name}</span>
          </div>

          {/* Platform selector */}
          <div className="hidden sm:flex items-center gap-1 bg-secondary p-1">
            {PLATFORMS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedId(p.id)}
                aria-pressed={p.id === selectedId}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium transition-colors',
                  p.id === selectedId
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {p.name}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => go('/login')} disabled={pending === '/login'}>
              Sign in
            </Button>
            <Button size="sm" onClick={() => go('/signup')} disabled={pending === '/signup'}>
              Get started
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative gradient-hero">
        <div className="mx-auto max-w-[1200px] px-6 pt-20 pb-16">
          <div className="max-w-3xl">
            {/* Mobile platform selector */}
            <div className="sm:hidden mb-6 inline-flex items-center gap-1 bg-secondary p-1">
              {PLATFORMS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedId(p.id)}
                  aria-pressed={p.id === selectedId}
                  className={cn(
                    'px-3 py-1.5 text-xs font-medium transition-colors',
                    p.id === selectedId
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground'
                  )}
                >
                  {p.name}
                </button>
              ))}
            </div>

            <div className="inline-flex items-center gap-2 bg-secondary px-3 py-1 text-xs font-medium text-muted-foreground mb-6">
              <Sparkles className="h-3.5 w-3.5" />
              {platform.tag}
            </div>
            <h1 className="font-display text-5xl md:text-6xl font-bold tracking-tight leading-[1.05]">
              {platform.headline.pre}
              <span className="text-accent">{platform.headline.highlight}</span>
              {platform.headline.post}
            </h1>
            <p className="mt-6 text-lg text-muted-foreground max-w-2xl leading-relaxed">
              {platform.desc}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" className="gap-2" onClick={() => go('/signup')} disabled={pending === '/signup'}>
                Start building <ArrowRight className="h-4 w-4" />
              </Button>
              <Button size="lg" variant="outline" onClick={() => go('/login')} disabled={pending === '/login'}>
                Sign in to dashboard
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
