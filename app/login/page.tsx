import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { LoginForm } from './login-form'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function LoginPage() {
  const session = await getServerSession(authOptions)
  if (session?.user) redirect('/dashboard')

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left — form */}
      <div className="flex flex-col">
        <div className="p-6">
          <Link href="/" className="inline-flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center bg-primary text-primary-foreground font-display font-bold text-sm">
              N5
            </div>
            <span className="font-display font-semibold text-lg tracking-tight">N5Deal</span>
          </Link>
        </div>
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-sm">
            <h1 className="font-display text-3xl font-semibold tracking-tight">
              Welcome back
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Sign in to your N5Deal workspace.
            </p>
            <div className="mt-8">
              <LoginForm />
            </div>
            <p className="mt-6 text-sm text-muted-foreground text-center">
              New here?{' '}
              <Link href="/signup" className="text-accent hover:underline font-medium">
                Create an account
              </Link>
            </p>
          </div>
        </div>
      </div>
      {/* Right — decorative */}
      <div className="hidden lg:block bg-primary text-primary-foreground relative overflow-hidden">
        <div className="absolute inset-0 grid-bg opacity-10" />
        <div className="relative flex h-full flex-col justify-between p-12">
          <div />
          <div className="max-w-md">
            <p className="text-xs uppercase tracking-widest text-primary-foreground/60 font-medium">
              N5Deal Marketing Platform
            </p>
            <h2 className="mt-4 font-display text-3xl font-semibold leading-tight tracking-tight">
              “Ship ICP-driven content 3x faster — without losing the
              compliance thread.”
            </h2>
            <p className="mt-6 text-sm text-primary-foreground/70">
              Built for fintech builders. Content engine across 7 ICPs and 8
              SEO clusters.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
