#!/usr/bin/env bash
# ────────────────────────────────────────────────────────────────────────────
# Sync your local Obsidian vault to the production VM via rsync.
#
# Run this on YOUR LOCAL MACHINE, not on the VM. The app there reads the
# vault from /opt/n5deal/obsidian-vaults (mounted into the container at
# /var/obsidian-vaults, read-only).
#
# Usage:
#   VM_HOST=dash.your-domain.com bash scripts/deploy-vault.sh /path/to/vault
#
# Optional env:
#   VM_USER  — SSH user (default: deploy)
#   VM_PATH  — remote path (default: /opt/n5deal/obsidian-vaults)
#   DRY_RUN  — 1 = show what would copy, don't actually copy
#
# The script:
#   - --delete prunes files removed locally so the vault on the VM stays a
#     true mirror (no stale notes hanging around)
#   - --exclude protects .obsidian/ config + .trash + .git so we ship only
#     the markdown corpus the RAG needs
#   - --partial + --info=progress2 give a live progress bar even on flaky links
# ────────────────────────────────────────────────────────────────────────────

set -euo pipefail

if [[ $# -lt 1 ]]; then
  cat <<EOF >&2
Usage: VM_HOST=<host> $0 <local-vault-path> [<subdir-on-vm>]

Example:
  VM_HOST=dash.n5deal.com $0 ~/Documents/N5DealVault
  VM_HOST=dash.n5deal.com $0 ~/Documents/N5DealVault n5deal-project   # → /opt/n5deal/obsidian-vaults/n5deal-project

Optional:
  VM_USER=deploy (default)
  VM_PATH=/opt/n5deal/obsidian-vaults (default)
  DRY_RUN=1  - preview without copying
EOF
  exit 1
fi

LOCAL_VAULT="$(cd "$1" && pwd)"
SUBDIR="${2:-}"
VM_HOST="${VM_HOST:?VM_HOST env required (your VM hostname or IP)}"
VM_USER="${VM_USER:-deploy}"
VM_PATH="${VM_PATH:-/opt/n5deal/obsidian-vaults}"
DRY_RUN="${DRY_RUN:-0}"

if [[ -n "$SUBDIR" ]]; then
  REMOTE_PATH="$VM_PATH/$SUBDIR/"
else
  REMOTE_PATH="$VM_PATH/"
fi

# Sanity-check the source is actually a vault — every Obsidian vault has a
# .obsidian/ directory, so missing one is usually a mistyped path.
if [[ ! -d "$LOCAL_VAULT/.obsidian" ]]; then
  echo "Warning: $LOCAL_VAULT has no .obsidian/ — is this really a vault root?"
  read -r -p "Continue anyway? [y/N] " ans
  [[ "$ans" == "y" || "$ans" == "Y" ]] || exit 1
fi

RSYNC_FLAGS=(
  --archive          # -a: recursive, preserve perms / times / symlinks
  --compress         # -z: cheap CPU win over network
  --delete           # mirror — remove remote files no longer in source
  --partial          # keep partial transfers if rsync is killed
  --info=progress2   # nicer live progress
  --human-readable
)
[[ "$DRY_RUN" == "1" ]] && RSYNC_FLAGS+=("--dry-run")

# Excludes: Obsidian's own metadata + workspace state are noise the RAG
# doesn't want. .git too if your vault is also a git repo.
RSYNC_EXCLUDES=(
  --exclude=".obsidian/workspace*"
  --exclude=".obsidian/cache"
  --exclude=".trash/"
  --exclude=".git/"
  --exclude=".DS_Store"
  --exclude="*.tmp"
)

echo "Syncing $LOCAL_VAULT → $VM_USER@$VM_HOST:$REMOTE_PATH"
[[ "$DRY_RUN" == "1" ]] && echo "(DRY RUN — nothing will be written)"
echo

ssh "$VM_USER@$VM_HOST" "mkdir -p $REMOTE_PATH"

rsync "${RSYNC_FLAGS[@]}" "${RSYNC_EXCLUDES[@]}" \
  "$LOCAL_VAULT/" \
  "$VM_USER@$VM_HOST:$REMOTE_PATH"

echo
echo "✓ Vault sync complete."
echo
echo "Trigger re-embedding from the dashboard's RAG settings page,"
echo "or run a one-off rebuild on the VM:"
echo "  ssh $VM_USER@$VM_HOST"
echo "  cd /opt/n5deal/app"
echo "  docker compose exec app sh -c 'npm run export-kb'"
