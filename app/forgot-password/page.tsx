import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { ForgotPasswordForm } from './forgot-password-form'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function ForgotPasswordPage() {
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
              Forgot password?
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Enter the email you signed up with and we'll send you a link to choose a new one.
            </p>
            <div className="mt-8">
              <ForgotPasswordForm />
            </div>
            <p className="mt-6 text-sm text-muted-foreground text-center">
              Remembered it?{' '}
              <Link href="/login" className="text-accent hover:underline font-medium">
                Back to sign in
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
              N5Deal Marketing Platform
            </p>
            <h2 className="mt-4 font-display text-3xl font-semibold leading-tight tracking-tight">
              Quick recovery, same workspace.
            </h2>
            <p className="mt-6 text-sm text-primary-foreground/70">
              The reset link is valid for 60 minutes and only works once.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
