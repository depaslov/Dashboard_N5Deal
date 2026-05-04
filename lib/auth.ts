import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { PrismaAdapter } from '@next-auth/prisma-adapter'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

// Pre-computed dummy hash so we always run a bcrypt.compare on the
// "user not found" path. Without this, a missing email returns in <1ms while
// a real email triggers a ~100ms compare — letting an attacker enumerate
// registered addresses by timing.
const DUMMY_HASH = '$2a$12$CwTycUXWue0Thq9StjUM0uJ8dG7y9Lh5/A5SkzYZP6eEzlNQ4dM6S'

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as any,
  session: { strategy: 'jwt', maxAge: 60 * 60 * 24 * 7 }, // 7 days
  pages: {
    signIn: '/login',
  },
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials, req) {
        const ip = getClientIp(req as any)
        const email = credentials?.email?.toLowerCase?.().trim?.()
        const password = credentials?.password
        if (!email || !password) return null

        const limit = rateLimit(`login:${ip}:${email}`, 10, 60_000)
        if (!limit.ok) return null

        const user = await prisma.user.findUnique({ where: { email } })

        // Always run a bcrypt.compare to keep timing constant across branches.
        const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH)
        if (!user || !ok) return null

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        } as any
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = (user as any)?.id
        token.role = (user as any)?.role ?? 'user'
      }
      return token
    },
    async session({ session, token }) {
      if (session?.user) {
        (session.user as any).id = token?.id
        ;(session.user as any).role = token?.role
      }
      return session
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
}
