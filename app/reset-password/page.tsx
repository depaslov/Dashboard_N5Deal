import Link from 'next/link'
import { ResetPasswordForm } from './reset-password-form'

export const dynamic = 'force-dynamic'

// Token comes in as ?token=... — we don't validate it server-side here
// (the form's submit hits the confirm endpoint which validates it). If
// the token is missing we still render the form; it'll fail with a
// readable error on submit.
export default function ResetPasswordPage({
  searchParams,
}: {
  searchParams: { token?: string }
}) {
  const token = searchParams.token ?? ''

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
              Choose a new password
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Pick something you don't use elsewhere. Minimum 8 characters.
            </p>
            <div className="mt-8">
              <ResetPasswordForm token={token} />
            </div>
            <p className="mt-6 text-sm text-muted-foreground text-center">
              Changed your mind?{' '}
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
              Almost there.
            </h2>
            <p className="mt-6 text-sm text-primary-foreground/70">
              After you save, all other reset links for this account stop working.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
