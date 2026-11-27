# Round 2 Admin-Demo Deployment Guide

This guide deploys **Round 2 (Coding Platform)** on an isolated Neon branch + VM with **real Judge0 CE**, **Nginx + HTTPS**, and a **Vercel preview** frontend — without touching production data.

---

## 1. Create an Isolated Neon Branch
Never run demo seeds or migrations against the production branch.

```bash
# Install Neon CLI if needed: npm i -g neonctl
neonctl branches create --project-id <NEON_PROJECT_ID> --name demo-round2 --parent main
neonctl connection-string demo-round2 --project-id <NEON_PROJECT_ID>
```

Save the pooled connection string as `DATABASE_URL` in your VM `/etc/examsecure/demo.env`.

---

## 2. Run Migrations (v2 -> v4) & Seed Demo Exam on the Branch
On the VM (or from your workstation pointing `DATABASE_URL` at `demo-round2`):

```bash
cd backend
export DATABASE_URL="postgresql+psycopg://<demo-round2-user>:<pass>@<host>/<db>?sslmode=require"

python migrations/add_coding_round_v2.py
python migrations/add_coding_hardening_v3.py
python migrations/add_coding_results_v4.py

# Seed DEMO Coding Round (3 questions, DEMO candidate qualified in Round 1)
python scripts/seed_coding_demo.py --force
```

---

## 3. VM Setup (Docker + Judge0 CE + Firewall)
```bash
# Install Docker & Compose plugin (Ubuntu 22.04/24.04)
sudo apt-get update && sudo apt-get install -y docker.io docker-compose-v2 nginx certbot python3-certbot-nginx

# Generate strong secrets
export APP_REDIS_PASS=$(openssl rand -hex 24)
export JUDGE0_REDIS_PASS=$(openssl rand -hex 24)
export JUDGE0_DB_PASS=$(openssl rand -hex 24)
export JUDGE0_AUTH_TOKEN=$(openssl rand -hex 24)

# Start Redis + Judge0 (judge0-server stays on internal docker network + 127.0.0.1:2358)
docker compose -f docker-compose.coding.yml up -d
```

### Firewall Rules (Only Backend Reaches Judge0)
```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw deny 2358/tcp   # Block external access to Judge0
sudo ufw enable
```

---

## 4. Backend Service (`systemd`) + Nginx HTTPS
Create `/etc/examsecure/demo.env`:

```ini
ENVIRONMENT=demo
DEBUG=false
SECRET_KEY=<64-char-random-hex>
ADMIN_BOOTSTRAP_PASSWORD=<strong-demo-admin-password>
DATABASE_URL=postgresql+psycopg://<demo-round2-pooled-url>?sslmode=require
REDIS_URL=redis://:${APP_REDIS_PASS}@127.0.0.1:6379/0

CODING_ROUND_ENABLED=true
CODING_SANDBOX_DRIVER=judge0
LOCAL_DEMO_SANDBOX=false
JUDGE0_URL=http://127.0.0.1:2358
JUDGE0_AUTH_TOKEN=${JUDGE0_AUTH_TOKEN}

# CORS & Cookies for Vercel preview domain
CORS_ORIGINS=["https://<your-vercel-preview>.vercel.app"]
COOKIE_SECURE=true
```

Create `/etc/systemd/system/examsecure-backend.service` and `/etc/systemd/system/examsecure-worker.service`:

```ini
# /etc/systemd/system/examsecure-backend.service
[Unit]
Description=ExamSecure FastAPI Backend (Demo)
After=network.target docker.service

[Service]
WorkingDirectory=/opt/examsecure/backend
EnvironmentFile=/etc/examsecure/demo.env
ExecStart=/opt/examsecure/venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers 2
Restart=always

[Install]
WantedBy=multi-user.target
```

```ini
# /etc/systemd/system/examsecure-worker.service
[Unit]
Description=ExamSecure ARQ Coding Worker (Demo)
After=network.target docker.service

[Service]
WorkingDirectory=/opt/examsecure/backend
EnvironmentFile=/etc/examsecure/demo.env
ExecStart=/opt/examsecure/venv/bin/arq worker.coding_worker.WorkerSettings
Restart=always

[Install]
WantedBy=multi-user.target
```

Enable Nginx with `nginx/conf.d/exam_portal.conf` and issue TLS certs:

```bash
sudo certbot --nginx -d api-demo.example.com
sudo systemctl enable --now examsecure-backend examsecure-worker
```

---

## 5. Vercel Preview Env Vars
In Vercel Project Settings -> Environment Variables (Preview scope):
- `VITE_CODING_ROUND_ENABLED=true`
- `VITE_API_BASE_URL=https://api-demo.example.com/api`

Redeploy the preview branch so Vite bakes the env vars into the bundle.

---

## 6. Run Preflight Verification
```bash
cd backend
export BACKEND_URL="https://api-demo.example.com"
export FRONTEND_ORIGIN="https://<your-vercel-preview>.vercel.app"
python scripts/demo_preflight.py
```

Every check (`DB`, `Migrations`, `Judge0`, `4-language real runs`, `Cookies/CORS`, `Polling/SSE`) must print `PASS` before the admin demo.

---

## 7. Teardown Checklist
1. `python scripts/seed_coding_demo.py --remove --force` (if reusing DB) or delete the Neon branch:
   `neonctl branches delete demo-round2 --project-id <NEON_PROJECT_ID>`
2. Stop & remove demo containers and volumes:
   `docker compose -f docker-compose.coding.yml down -v`
3. Stop & disable `examsecure-backend` and `examsecure-worker`.
4. Remove Vercel preview env vars / close preview deployment.
5. Rotate `JUDGE0_AUTH_TOKEN` and `SECRET_KEY`.
