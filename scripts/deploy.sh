#!/usr/bin/env bash
# ────────────────────────────────────────────────────────────────────────────
# Per-release deploy. Run on the VM, from $APP_DIR, as the deploy user.
#
# Idempotent steps:
#   1. Fast-forward main from origin
#   2. Compare the new commit to the deployed one — short-circuit if nothing
#      changed (saves a 2-minute rebuild on a force-deploy with no changes)
#   3. Push Prisma schema if it moved (Neon — Postgres SQL)
#   4. Rebuild + restart the app container (Nginx stays up unchanged)
#   5. Health-check the new container before declaring success
#
# Rollback: `git checkout <prev-sha>` then re-run this script.
# ────────────────────────────────────────────────────────────────────────────

set -euo pipefail

cd "$(dirname "$0")/.."
APP_DIR="$(pwd)"
log() { echo -e "\033[1;32m[deploy]\033[0m $*"; }
warn() { echo -e "\033[1;33m[deploy]\033[0m $*"; }
err() { echo -e "\033[1;31m[deploy]\033[0m $*" >&2; }

# Safety: refuse to deploy if .env is missing — without secrets the container
# would start, fail NextAuth/Prisma init, and crash-loop. Cheaper to fail here.
if [[ ! -f .env ]]; then
  err ".env missing — copy .env.production.example to .env and fill in secrets"
  exit 1
fi

# ── 1. Pull latest main ─────────────────────────────────────────────────────
log "Fetching origin…"
git fetch --prune origin

CURRENT_SHA=$(git rev-parse HEAD)
TARGET_SHA=$(git rev-parse origin/main)

if [[ "$CURRENT_SHA" == "$TARGET_SHA" ]]; then
  if [[ "${1:-}" != "--force" ]]; then
    log "Already at $TARGET_SHA — nothing to do. Pass --force to rebuild anyway."
    exit 0
  fi
  warn "Same SHA but --force given — rebuilding"
fi

log "Updating $CURRENT_SHA → $TARGET_SHA"
git reset --hard "$TARGET_SHA"

# ── 2. Detect schema changes — Prisma needs to push them before app starts ─
SCHEMA_CHANGED=false
if ! git diff --quiet "$CURRENT_SHA" "$TARGET_SHA" -- prisma/schema.prisma 2>/dev/null; then
  SCHEMA_CHANGED=true
  log "prisma/schema.prisma changed — will push schema to DB"
fi

# ── 3. Build the new image ──────────────────────────────────────────────────
log "Building new image (this takes 2-5 minutes on first build)…"
docker compose build app

# ── 4. Push Prisma schema if needed ─────────────────────────────────────────
# Run inside a one-shot container that has DATABASE_URL from .env. We use
# `db push` (not `migrate deploy`) to match the workflow already in use for
# local + previous Neon pushes — no migration files are versioned in the repo.
if [[ "$SCHEMA_CHANGED" == "true" ]]; then
  log "Pushing Prisma schema to Neon…"
  docker compose run --rm --no-deps app sh -c "npx prisma db push --skip-generate --accept-data-loss"
fi

# ── 5. Restart with zero-ish downtime ───────────────────────────────────────
# docker compose `up -d` with `--no-recreate` would skip the new image; force
# recreation. Nginx stays up (it's a dependency, not a parent), so users see
# a brief 502 between old container stop and new container healthy.
log "Restarting app container…"
docker compose up -d --force-recreate --no-deps app

# ── 6. Wait for the new container's healthcheck ─────────────────────────────
log "Waiting for healthy status…"
for i in $(seq 1 30); do
  STATE=$(docker inspect -f '{{.State.Health.Status}}' n5deal-app 2>/dev/null || echo "unknown")
  if [[ "$STATE" == "healthy" ]]; then
    log "✓ App healthy at $TARGET_SHA"
    break
  fi
  if [[ "$STATE" == "unhealthy" ]]; then
    err "App reported unhealthy — check logs: docker compose logs --tail=200 app"
    exit 1
  fi
  sleep 2
done

if [[ "$STATE" != "healthy" ]]; then
  err "Timed out waiting for health — check logs: docker compose logs --tail=200 app"
  exit 1
fi

# ── 7. Prune dangling images so disk doesn't fill ──────────────────────────
docker image prune -f >/dev/null

log "Deploy complete. App is running at $TARGET_SHA."
