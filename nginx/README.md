# ExamSecure Enterprise - Nginx Load Balancer & High-Concurrency Architecture

## 1. Architecture Overview (800 Concurrent Candidates)

```
                            [ 800+ Simultaneous Candidates ]
                                         │
                                         ▼
                 ┌──────────────────────────────────────────────┐
                 │          NGINX REVERSE PROXY & LB           │
                 │   Port 80 (HTTP) / 443 (HTTPS)               │
                 │   - Static Asset Caching (Vite dist/)       │
                 │   - Connection Pool (4096 workers)          │
                 │   - Rate Limit Zone: 150 r/s (burst=300)     │
                 │   - Least Connections Algorithm (least_conn)│
                 └───────────────────────┬──────────────────────┘
                                         │
                 ┌───────────────────────┼──────────────────────┐
                 ▼                       ▼                      ▼
        ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
        │ FastAPI Worker  │    │ FastAPI Worker  │    │ FastAPI Worker  │  ... (4 Workers)
        │ Port 8000       │    │ Port 8001       │    │ Port 8002 / 8003│
        └────────┬────────┘    └────────┬────────┘    └────────┬────────┘
                 │                      │                      │
                 └──────────────────────┼──────────────────────┘
                                         │
                                         ▼
                 ┌──────────────────────────────────────────────┐
                 │      Neon Serverless PostgreSQL Pooler       │
                 │   aws.neon.tech:5432 (pgBouncer transaction) │
                 │   - Pool size: 25 / Max overflow: 25         │
                 │   - TCP Keepalives (idle 30s, interval 10s)  │
                 │   - Atomic Upserts (PostgreSQL ON CONFLICT)  │
                 │   - Batch Mapping Inserts (150x reduction)   │
                 └──────────────────────────────────────────────┘
```

---

## 2. Deploying on Windows

### Option A: Using Windows Nginx Binary
1. Download official Windows Nginx: `https://nginx.org/en/download.html` (e.g. `nginx-1.26.x.zip`).
2. Extract to `C:\nginx` (or any preferred folder).
3. Copy `nginx/nginx.conf` and `nginx/conf.d/` into `C:\nginx\conf\`.
4. Validate configuration:
   ```cmd
   cd C:\nginx
   nginx.exe -t
   ```
5. Launch Nginx:
   ```cmd
   start nginx.exe
   ```
6. To reload configuration after edits:
   ```cmd
   nginx.exe -s reload
   ```

---

## 3. Deploying on Linux (Ubuntu / Debian / RHEL)

1. Install Nginx:
   ```bash
   sudo apt-get update
   sudo apt-get install -y nginx
   ```
2. Link or copy configuration:
   ```bash
   sudo cp nginx/nginx.conf /etc/nginx/nginx.conf
   sudo cp nginx/conf.d/exam_portal.conf /etc/nginx/conf.d/
   ```
3. Test syntax:
   ```bash
   sudo nginx -t
   ```
4. Enable and restart service:
   ```bash
   sudo systemctl enable nginx
   sudo systemctl restart nginx
   ```

---

## 4. Key Performance Optimizations

| Area | Optimization | Benefit |
|---|---|---|
| **Load Balancing** | `least_conn` with 4 Uvicorn workers | Evenly balances memory and CPU across processes; eliminates hot spots. |
| **Static Assets** | Browser cache: 1 year immutable (`/assets/`) | 800 candidates do not fetch JS/CSS bundles repeatedly, saving bandwidth. |
| **API Buffering** | 16x 64KB memory buffers (`proxy_buffers`) | Fast backend worker release; zero disk write I/O on large payloads. |
| **Live Telemetry** | WebSocket/SSE upgrade pass-through | Zero-latency proctor video snapshots and real-time admin sync. |
| **Database Pool** | 25 connections + 25 overflow per worker | Neon pgBouncer handles 10,000 backend connections effortlessly. |
| **Batch Insert** | `db.bulk_insert_mappings` on exam start | Reduces roundtrips from 300 to 2 per candidate (150x faster start). |
| **Atomic Upsert** | PostgreSQL `ON CONFLICT DO UPDATE` | Single-roundtrip O(1) answer save without lock contention or deadlocks. |
| **Debounced Autosave**| 300ms client debounce + attempt-scoped storage | Eliminates request flooding and prevents computer lab session leakage. |
