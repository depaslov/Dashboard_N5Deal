#!/usr/bin/env bash
# ────────────────────────────────────────────────────────────────────────────
# One-time Hostinger VPS bootstrap for the N5Deal dashboard.
#
# Run this ONCE on a fresh Ubuntu 22.04 / 24.04 VM as root or via sudo. It:
#   1. Installs Docker + docker-compose-plugin from the official repo
#   2. Creates the project + data dirs (/opt/n5deal/{app,obsidian-vaults,logs})
#   3. Configures the UFW firewall (SSH + 80 + 443)
#   4. Clones the repo and points Nginx at the chosen domain
#   5. Adds a non-root deploy user with docker group access
#
# AFTER this finishes:
#   - sudo su - deploy
#   - cd /opt/n5deal/app
#   - cp .env.production.example .env  → fill in real secrets
#   - bash scripts/deploy.sh            → first deploy
#   - issue TLS cert (see DEPLOYMENT.md)
#
# Idempotent: rerunning is safe; each step is wrapped in an "already done?"
# check so the script can be replayed if it dies halfway through.
# ────────────────────────────────────────────────────────────────────────────

set -euo pipefail

# ── Config (override via env when invoking) ─────────────────────────────────
REPO_URL="${REPO_URL:-https://github.com/depaslov/Dashboard_N5Deal.git}"
DOMAIN="${DOMAIN:-dash.your-domain.com}"
DEPLOY_USER="${DEPLOY_USER:-deploy}"
PROJECT_ROOT="${PROJECT_ROOT:-/opt/n5deal}"
APP_DIR="$PROJECT_ROOT/app"
VAULT_DIR="$PROJECT_ROOT/obsidian-vaults"
LOGS_DIR="$PROJECT_ROOT/logs"

log() { echo -e "\033[1;32m[setup-vm]\033[0m $*"; }
warn() { echo -e "\033[1;33m[setup-vm]\033[0m $*"; }
err() { echo -e "\033[1;31m[setup-vm]\033[0m $*" >&2; }

if [[ $EUID -ne 0 ]]; then
  err "Run as root (sudo bash scripts/setup-vm.sh)"
  exit 1
fi

# ── 1. System update + base packages ────────────────────────────────────────
log "Updating apt + installing base packages…"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq \
  ca-certificates curl gnupg lsb-release \
  ufw git rsync htop

# ── 2. Docker (official repo, not the distro's old version) ─────────────────
if ! command -v docker >/dev/null 2>&1; then
  log "Installing Docker from official repo…"
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
    | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
     https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  systemctl enable --now docker
else
  log "Docker already installed ($(docker --version)) — skipping"
fi

# ── 3. Deploy user (non-root, can run docker) ───────────────────────────────
if ! id "$DEPLOY_USER" >/dev/null 2>&1; then
  log "Creating deploy user '$DEPLOY_USER'…"
  useradd -m -s /bin/bash "$DEPLOY_USER"
  usermod -aG docker "$DEPLOY_USER"
  # SSH key forwarding: copy authorized_keys from root so the same SSH key
  # can log in as either user. Adjust if you provision keys differently.
  if [[ -f /root/.ssh/authorized_keys ]]; then
    mkdir -p "/home/$DEPLOY_USER/.ssh"
    cp /root/.ssh/authorized_keys "/home/$DEPLOY_USER/.ssh/authorized_keys"
    chmod 700 "/home/$DEPLOY_USER/.ssh"
    chmod 600 "/home/$DEPLOY_USER/.ssh/authorized_keys"
    chown -R "$DEPLOY_USER:$DEPLOY_USER" "/home/$DEPLOY_USER/.ssh"
  fi
else
  log "Deploy user '$DEPLOY_USER' already exists — skipping"
fi

# ── 4. Project directory tree ───────────────────────────────────────────────
log "Creating project tree at $PROJECT_ROOT…"
mkdir -p "$VAULT_DIR" "$LOGS_DIR/app" "$LOGS_DIR/nginx"

# Clone the repo if it's not there; otherwise leave existing for deploy.sh.
if [[ ! -d "$APP_DIR/.git" ]]; then
  log "Cloning $REPO_URL → $APP_DIR…"
  git clone --depth 50 "$REPO_URL" "$APP_DIR"
else
  log "Repo already present at $APP_DIR — skipping clone"
fi

# Ownership transfer so deploy user can git pull / docker compose up without sudo.
chown -R "$DEPLOY_USER:$DEPLOY_USER" "$PROJECT_ROOT"

# ── 5. Domain placeholder swap in Nginx config ──────────────────────────────
NGINX_CONF="$APP_DIR/nginx/n5deal.conf"
if [[ -f "$NGINX_CONF" ]] && [[ "$DOMAIN" != "dash.your-domain.com" ]]; then
  log "Patching nginx config with domain: $DOMAIN"
  sed -i.bak "s/dash\.your-domain\.com/$DOMAIN/g" "$NGINX_CONF"
fi

# ── 6. Firewall (UFW) ───────────────────────────────────────────────────────
log "Configuring UFW (SSH + 80 + 443)…"
ufw --force reset >/dev/null
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# ── 7. Optional swap (if VM has < 2GB RAM) ──────────────────────────────────
TOTAL_RAM_MB=$(awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo)
if [[ $TOTAL_RAM_MB -lt 2048 ]] && [[ ! -f /swapfile ]]; then
  log "Low RAM (${TOTAL_RAM_MB}MB) — creating 2GB swapfile to help npm build…"
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile >/dev/null
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

# ── Done ────────────────────────────────────────────────────────────────────
cat <<EOF

✓ VM bootstrap complete.

Next steps:
  sudo su - $DEPLOY_USER
  cd $APP_DIR
  cp .env.production.example .env       # fill in real secrets
  bash scripts/deploy.sh                # first deploy

  # Issue TLS cert after DNS points to this VM:
  docker compose run --rm certbot certonly --webroot \\
    -w /var/www/certbot -d $DOMAIN \\
    --email you@example.com --agree-tos --no-eff-email

  # Then uncomment the HTTPS server block in nginx/n5deal.conf and:
  docker compose restart nginx

Obsidian vault sync (run on YOUR LOCAL machine, not the VM):
  VM_HOST=$DOMAIN bash scripts/deploy-vault.sh /path/to/local/vault

EOF
