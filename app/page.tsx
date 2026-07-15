import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { PlatformLanding } from '@/components/marketing/platform-landing'
import { Users, FileText, LayoutDashboard, ShieldCheck } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const session = await getServerSession(authOptions)
  if (session?.user) {
    redirect('/dashboard')
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header + hero with platform selector (re-skins per platform) */}
      <PlatformLanding />

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
