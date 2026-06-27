# Deployment — Hostinger VPS

End-to-end guide for deploying the N5Deal Dashboard to a Hostinger VPS.

**Stack:** Docker + docker-compose, Nginx reverse proxy, Let's Encrypt TLS, Neon Postgres (cloud), rsync-synced Obsidian vault on the VM filesystem.

**Why not Vercel:** Obsidian vault reads and RAG embedding pipelines need a persistent filesystem and long-running processes — neither fits a serverless runtime. A VPS gives both at predictable cost.

---

## 0. Prerequisites

- A Hostinger KVM VPS (minimum **2 vCPU / 4 GB RAM / 40 GB SSD** — Next.js standalone runs fine at this size; lower will OOM during `next build`).
- A domain or subdomain you control (e.g. `dash.n5deal.com`).
- Your local machine with `ssh`, `rsync`, and the project repo cloned.
- Neon production DATABASE_URL ready (you already use this in dev).
- Abacus.AI API key.

---

## 1. Provision the VM

In Hostinger's VPS panel:

1. Create a new KVM VPS — choose **Ubuntu 24.04 LTS** (or 22.04).
2. Add your SSH public key during creation.
3. Note the public IPv4.

Point DNS at the VM:

| Type | Name | Value |
| --- | --- | --- |
| A | `dash` (or whatever subdomain you picked) | `<VM public IPv4>` |

Wait ~5 minutes for DNS propagation. Verify:

```bash
dig +short dash.n5deal.com
# → should return your VM IP
```

---

## 2. First-time VM bootstrap

SSH in as root and run the one-time setup script:

```bash
ssh root@dash.n5deal.com

# Clone the bootstrap script (or paste it in via vi if you prefer not to git on root)
curl -fsSL https://raw.githubusercontent.com/depaslov/Dashboard_N5Deal/main/scripts/setup-vm.sh -o /tmp/setup-vm.sh

# Run with your domain set so Nginx config is patched automatically
DOMAIN=dash.n5deal.com bash /tmp/setup-vm.sh
```

What it does (idempotent — safe to rerun):

- Installs Docker + docker-compose-plugin from the official repo.
- Creates `/opt/n5deal/{app,obsidian-vaults,logs}` and clones the repo into `/opt/n5deal/app`.
- Creates a non-root `deploy` user (member of `docker` group, inherits your SSH keys).
- Configures UFW firewall (SSH + 80 + 443 only).
- If the VM has < 2 GB RAM, adds a 2 GB swapfile so `next build` doesn't OOM.

The script prints next-step instructions when done.

---

## 3. Configure secrets

Switch to the deploy user and populate the production `.env`:

```bash
sudo su - deploy
cd /opt/n5deal/app

cp .env.production.example .env
nano .env       # or vi, your call
```

Fill in **at minimum**:

- `DATABASE_URL` — your production Neon URL
- `NEXTAUTH_URL` — `https://dash.n5deal.com` (must match exactly, no trailing slash)
- `NEXTAUTH_SECRET` — generate with `openssl rand -base64 32`
- `ABACUSAI_API_KEY` — your Abacus.AI key

Everything else has sensible defaults baked into the file.

> **⚠ Security:** the `.env` is `0600` and lives only on the VM. Don't `git add` it — the repo's `.gitignore` already excludes it. If a developer leaves the project, rotate all the secrets in this file.

---

## 4. First deploy

Still as `deploy` in `/opt/n5deal/app`:

```bash
bash scripts/deploy.sh
```

What it does:

1. Pulls latest `main`.
2. If `prisma/schema.prisma` changed since last deploy, pushes the schema to Neon.
3. Builds the Docker image (2–5 minutes first time, cached after).
4. Starts the `app` + `nginx` containers via docker-compose.
5. Waits for the app's healthcheck (`GET /api/health`) before declaring success.

After it finishes, the dashboard is reachable on **port 80** (HTTP). Test with:

```bash
curl -I http://dash.n5deal.com
# → HTTP/1.1 301 Moved Permanently  (redirect to HTTPS — TLS not issued yet)
```

The redirect lands on HTTPS which doesn't have a cert yet — that's expected. Next step fixes it.

---

## 5. Issue the TLS cert (Let's Encrypt)

The Nginx config is split into two `server` blocks:

- **Port 80** — always active, serves the ACME challenge.
- **Port 443** — commented out by default because Nginx would fail to start if the cert doesn't exist yet.

Issue the cert via the Certbot sidecar:

```bash
docker compose run --rm certbot certonly --webroot \
  -w /var/www/certbot \
  -d dash.n5deal.com \
  --email you@example.com \
  --agree-tos --no-eff-email
```

Successful output ends with `Successfully received certificate`.

Now uncomment the entire HTTPS server block in `nginx/n5deal.conf` (everything below the `# ── HTTPS (port 443) ──` divider). Then:

```bash
docker compose restart nginx
```

Test:

```bash
curl -I https://dash.n5deal.com
# → HTTP/1.1 200 OK
```

### Cert renewal

Let's Encrypt certs last 90 days. Add a cron entry on the VM as root:

```bash
sudo crontab -e
```

Append:

```cron
# Renew Let's Encrypt cert — runs twice daily, only acts when cert is < 30 days from expiry
0 0,12 * * * cd /opt/n5deal/app && docker compose run --rm certbot renew --quiet && docker compose exec nginx nginx -s reload >> /var/log/certbot-renew.log 2>&1
```

---

## 6. Sync the Obsidian vault

Run on **your local machine** (NOT the VM):

```bash
cd ~/Downloads/n5deal_export_v3        # or wherever the repo is locally

VM_HOST=dash.n5deal.com bash scripts/deploy-vault.sh ~/Documents/N5DealVault
```

The script:

- rsyncs your local vault to `/opt/n5deal/obsidian-vaults/` on the VM.
- Mirrors deletions (files removed locally are removed on the VM too).
- Skips `.obsidian/workspace*`, `.obsidian/cache`, `.trash/`, `.git/` — they're noise the RAG doesn't need.

Optional: pass a subdirectory name as the second arg to scope a vault per project:

```bash
VM_HOST=dash.n5deal.com bash scripts/deploy-vault.sh ~/Documents/N5DealVault n5deal-main
# → ends up at /opt/n5deal/obsidian-vaults/n5deal-main/ on the VM
```

The dashboard's RAG settings page lets you set per-project vault paths. Use the same subdirectory name there.

Dry-run mode (preview without writing):

```bash
DRY_RUN=1 VM_HOST=dash.n5deal.com bash scripts/deploy-vault.sh ~/Documents/N5DealVault
```

After syncing, trigger a re-embed from the dashboard's **RAG → Sync** UI, or kick it off via CLI:

```bash
ssh deploy@dash.n5deal.com
cd /opt/n5deal/app
docker compose exec app sh -c 'npm run export-kb'
```

---

## 7. Future deploys

```bash
ssh deploy@dash.n5deal.com
cd /opt/n5deal/app
bash scripts/deploy.sh
```

Edge cases:

- **Nothing changed** — script exits early. Pass `--force` to rebuild anyway.
- **Schema changed** — script detects the diff and runs `prisma db push` against Neon before rebuilding the image.
- **Build fails** — old container keeps running, no downtime; check logs (`docker compose logs --tail=200 app`) and fix in the repo.
- **Rollback** — `git checkout <prev-sha>` then re-run `bash scripts/deploy.sh`.

---

## 8. Operations cheatsheet

### Logs

```bash
# App logs (Next.js + your console.error / console.log)
docker compose logs --tail=200 -f app

# Nginx access + error logs
docker compose logs --tail=200 -f nginx

# Or on the host filesystem (mounted volumes):
tail -f /opt/n5deal/logs/app/*.log
tail -f /opt/n5deal/logs/nginx/access.log
```

### Restart only the app (Nginx stays up):

```bash
docker compose up -d --force-recreate --no-deps app
```

### Restart only Nginx (after a config change):

```bash
docker compose restart nginx
```

### Open a shell in the running container:

```bash
docker compose exec app sh
# from inside:
ls /var/obsidian-vaults
node -e "console.log(process.env.NEXTAUTH_URL)"
```

### Run a one-off Prisma command:

```bash
docker compose run --rm --no-deps app sh -c "npx prisma studio --port 5555 --hostname 0.0.0.0"
# Then SSH-tunnel: ssh -L 5555:localhost:5555 deploy@dash.n5deal.com
# Browse: http://localhost:5555
```

### Update DNS / domain

If you move to a different subdomain:

1. Update DNS A record.
2. Re-issue cert: `docker compose run --rm certbot certonly --webroot -w /var/www/certbot -d new-domain.com ...`
3. Update `nginx/n5deal.conf` — `server_name` and the cert paths.
4. Update `.env`: `NEXTAUTH_URL`.
5. `docker compose restart nginx` + `bash scripts/deploy.sh --force`.

---

## 9. Backups

- **Postgres** — Neon snapshots automatically (check Neon dashboard for retention policy).
- **Obsidian vault** — your local machine is the source of truth; the VM is a mirror. If the VM dies, re-run `deploy-vault.sh` to repopulate.
- **`.env`** — store a copy in a password manager (1Password, Bitwarden). Losing this means re-rotating every secret.
- **Generated content** — lives in Postgres (Neon), backed up there. No file-level backups needed.

---

## 10. Common issues

**"Connection refused" right after deploy**
→ Healthcheck is still warming up. Wait 30s, retry. Logs: `docker compose logs --tail=50 app`.

**502 Bad Gateway from Nginx**
→ App container is down or unhealthy. `docker compose ps` shows status. Usually a bad env var — check `.env` against `.env.production.example`.

**NextAuth "OAuthCallback" error after login**
→ `NEXTAUTH_URL` doesn't match the URL the browser is hitting. Edit `.env`, restart app: `docker compose up -d --force-recreate --no-deps app`.

**`next build` killed mid-build**
→ Out of memory on the VM. The setup script adds a 2 GB swapfile when RAM < 2 GB. If you're still OOMing on a 4 GB VPS, upgrade to 8 GB.

**Cert renewal cron didn't run**
→ Check `/var/log/certbot-renew.log`. Common cause: Nginx is the only port-80 listener and Certbot couldn't bind. The `--webroot` flow we use avoids this — make sure you used that command, not `certbot certonly --standalone`.

**Obsidian vault changes don't reflect**
→ The mount is read-only inside the container — only `deploy-vault.sh` updates it. After running rsync, the app picks up new files immediately for next request, but RAG embeddings need re-embedding (see §6).
