import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { ArrowRight, Sparkles, Users, FileText, LayoutDashboard, ShieldCheck } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const session = await getServerSession(authOptions)
  if (session?.user) {
    redirect('/dashboard')
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 w-full border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center bg-primary text-primary-foreground font-display font-bold text-sm">
              N5
            </div>
            <span className="font-display font-semibold text-lg tracking-tight">N5Deal</span>
          </Link>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href="/login">Sign in</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/signup">Get started</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative gradient-hero">
        <div className="mx-auto max-w-[1200px] px-6 pt-20 pb-16">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 bg-secondary px-3 py-1 text-xs font-medium text-muted-foreground mb-6">
              <Sparkles className="h-3.5 w-3.5" />
              AI-powered marketing brain
            </div>
            <h1 className="font-display text-5xl md:text-6xl font-bold tracking-tight leading-[1.05]">
              The centralized <span className="text-accent">AI brain</span> for
              ICP-driven content at scale.
            </h1>
            <p className="mt-6 text-lg text-muted-foreground max-w-2xl leading-relaxed">
              Manage ideal customer profiles, generate structured content briefs
              across LinkedIn, articles, catalogs and Telegram, and collaborate
              with your marketing team — all in one clean workspace.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/signup" className="gap-2">
                  Start building <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/login">Sign in to dashboard</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features grid */}
      <section className="border-t border-border bg-secondary/40">
        <div className="mx-auto max-w-[1200px] px-6 py-16">
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium">
            Phase 1 — MVP
          </p>
          <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight max-w-2xl">
            Everything your marketing team needs to ship compliant content faster.
          </h2>
          <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: LayoutDashboard, title: 'Executive dashboard', desc: 'KPIs, recent activity and quick actions at a glance.' },
              { icon: Users, title: 'ICP management', desc: 'Structured profiles: pain points, goals, budget, decision process.' },
              { icon: FileText, title: 'Content Studio', desc: 'AI-generated briefs for LinkedIn, articles, catalogs and Telegram.' },
              { icon: ShieldCheck, title: 'Team workspaces', desc: 'Multi-project support with member and admin roles.' },
            ].map((f) => (
              <div key={f.title} className="bg-card p-6 border border-border shadow-sm">
                <div className="flex h-10 w-10 items-center justify-center bg-primary text-primary-foreground">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 font-display font-semibold text-lg tracking-tight">{f.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto max-w-[1200px] px-6 py-6 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} N5Deal. Internal marketing platform.
          </p>
          <div className="flex gap-4 text-xs text-muted-foreground">
            <Link href="/login" className="hover:text-foreground">Sign in</Link>
            <Link href="/signup" className="hover:text-foreground">Get started</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
