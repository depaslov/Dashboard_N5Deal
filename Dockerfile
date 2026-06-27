# syntax=docker/dockerfile:1.6
# ────────────────────────────────────────────────────────────────────────────
# N5Deal Dashboard — production Dockerfile for Hostinger VPS deploy.
#
# Multi-stage build keeps the final image small (~250MB) by:
#   1. `deps`  → install only production dependencies + run `prisma generate`
#   2. `build` → install full deps, build Next.js with `output: 'standalone'`,
#                regenerate Prisma client against the build's node_modules
#   3. `runner` → copy ONLY the standalone server, static assets, public/, and
#                the Prisma client → runs as a non-root user.
#
# Why standalone: Next.js bundles the minimum node_modules into
# .next/standalone — no need to ship the full ~500MB devDependency tree to
# production. Image cold-starts in seconds; Hostinger 4GB VPS handles it fine.
#
# Postgres on Neon stays unchanged — the container only needs DATABASE_URL.
# Obsidian vault is mounted from the VM filesystem at /var/obsidian-vaults
# (read-only) so the app can read .md files at request time.
# ────────────────────────────────────────────────────────────────────────────

ARG NODE_VERSION=20.11.0
ARG ALPINE_VERSION=3.19

# ── Stage 1: deps ────────────────────────────────────────────────────────────
# Install full dependencies and generate the Prisma client. This stage's
# node_modules is later reused by the build stage.
FROM node:${NODE_VERSION}-alpine${ALPINE_VERSION} AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

# Copy only the manifest first so Docker can cache npm install across rebuilds
# that didn't touch dependencies.
COPY package.json package-lock.json* ./
COPY prisma ./prisma

# `--ignore-scripts` to skip postinstall here; we run prisma generate explicitly
# so a failure surfaces cleanly instead of being buried in npm output.
RUN npm ci --ignore-scripts
RUN npx prisma generate

# ── Stage 2: build ───────────────────────────────────────────────────────────
FROM node:${NODE_VERSION}-alpine${ALPINE_VERSION} AS build
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

# Reuse the deps stage's node_modules (already has @prisma/client generated).
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Re-generate Prisma client against this stage's node_modules path so the
# standalone server bundles it correctly.
RUN npx prisma generate

# Disable Next.js telemetry to avoid network calls during build on a Hostinger
# VPS that may have outbound rate limits or no IPv6.
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
# Force standalone output even if .env file overrides the default.
ENV NEXT_OUTPUT_MODE=standalone

RUN npm run build

# ── Stage 3: runner ──────────────────────────────────────────────────────────
# Minimal production runtime. Runs as non-root `nextjs` user. Only ships the
# standalone server bundle, static assets, public files, and the generated
# Prisma client — no source code, no devDependencies, no build cache.
FROM node:${NODE_VERSION}-alpine${ALPINE_VERSION} AS runner
WORKDIR /app

# OpenSSL is required by Prisma at runtime (for TLS to Neon).
RUN apk add --no-cache openssl curl

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Bind on all interfaces inside the container; Nginx talks to it over the
# internal docker network.
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

# Create a non-root user. Running Next.js as root inside a container is a
# common preventable foot-gun (any exploitable RCE would land as root).
RUN addgroup --system --gid 1001 nextjs \
 && adduser --system --uid 1001 --ingroup nextjs nextjs

# Copy the standalone server bundle. This INCLUDES a minimal node_modules
# specifically curated by Next.js to what the build actually imports.
COPY --from=build --chown=nextjs:nextjs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nextjs /app/.next/static ./.next/static
COPY --from=build --chown=nextjs:nextjs /app/public ./public

# Prisma's generated client + the schema (schema is needed at runtime by some
# Prisma operations like introspection / db push).
COPY --from=build --chown=nextjs:nextjs /app/prisma ./prisma
COPY --from=build --chown=nextjs:nextjs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build --chown=nextjs:nextjs /app/node_modules/@prisma/client ./node_modules/@prisma/client

USER nextjs
EXPOSE 3000

# Health endpoint for docker-compose's healthcheck. Hits the homepage which
# triggers the full Next.js bootstrap; if that returns 200 we know the app is
# really up, not just the TCP listener.
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD curl -fsS http://localhost:3000/api/health || exit 1

CMD ["node", "server.js"]
