import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { SignupForm } from './signup-form'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function SignupPage() {
  const session = await getServerSession(authOptions)
  if (session?.user) redirect('/dashboard')

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
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
              Create your workspace
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Get started in under a minute.
            </p>
            <div className="mt-8">
              <SignupForm />
            </div>
            <p className="mt-6 text-sm text-muted-foreground text-center">
              Already have an account?{' '}
              <Link href="/login" className="text-accent hover:underline font-medium">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
      <div className="hidden lg:block bg-primary text-primary-foreground relative overflow-hidden">
        <div className="absolute inset-0 grid-bg opacity-10" />
        <div className="relative flex h-full flex-col justify-between p-12">
          <div />
          <div className="max-w-md">
            <p className="text-xs uppercase tracking-widest text-primary-foreground/60 font-medium">
              What you get
            </p>
            <ul className="mt-6 space-y-4 text-sm text-primary-foreground/80">
              <li className="flex gap-3">
                <span className="h-1.5 w-1.5 mt-2 bg-primary-foreground" />
                <span>AI-powered brief generation for 4 content formats</span>
              </li>
              <li className="flex gap-3">
                <span className="h-1.5 w-1.5 mt-2 bg-primary-foreground" />
                <span>Structured ICP profiles with pain points, goals and budget</span>
              </li>
              <li className="flex gap-3">
                <span className="h-1.5 w-1.5 mt-2 bg-primary-foreground" />
                <span>Multi-project workspaces with team collaboration</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
