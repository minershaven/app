# MinersHaven — native install (no Docker)

Runs on a Linux VPS (Ubuntu 22.04 / 24.04 or Debian 12) next to your **Miningcore** install.
Miningcore runs the stratum server, coin daemons and payouts. MinersHaven is the public dashboard and admin panel, and reads everything from Miningcore's REST API.

```
miners ──stratum──▶ Miningcore (ports from its config.json) ──▶ PostgreSQL
                         │ REST API 127.0.0.1:4000
browser ──http(s)──▶ nginx ──/api──▶ MinersHaven API (uvicorn, systemd) ──▶ MongoDB (local)
                     └── static frontend (frontend/dist)
```

## 1. Enable Miningcore's API
In Miningcore's `config.json`:
```json
"api": { "enabled": true, "listenAddress": "127.0.0.1", "port": 4000 }
```
Restart Miningcore, then check: `curl http://127.0.0.1:4000/api/pools`

## 2. Install (one command)
Copy this project to the server (git clone or scp), then:
```bash
cd minershaven
sudo bash deploy/install.sh --domain pool.example.com --email you@example.com
```
| Option | Default | Meaning |
|---|---|---|
| `--domain` / `--email` | none | Sets nginx `server_name` and gets a Let's Encrypt HTTPS cert (DNS must already point to the server). |
| `--miningcore-url` | `http://127.0.0.1:4000` | Miningcore API base URL. |
| `--stratum-host` | domain or public IP | Host shown in the stratum connection commands. |
| `--demo` | off | Show simulated data instead of Miningcore (for trying it out). |
| `--dir` | `/opt/minershaven` | Install location. |

Without `--domain`, the site is served over HTTP on the server's IP.
The script prints the **admin passkey** once. It is stored in `/opt/minershaven/backend/.env` as `ADMIN_PASSWORD`.

The script installs Node 24 (used only to build the frontend), MongoDB 8.0, a Python venv, the `minershaven-api` systemd service and the nginx site.
MongoDB 5+ needs a CPU with AVX.

## 3. Map coins to Miningcore pools
Each coin (BTC, LTC, DOGE, ZANO) is linked automatically to the Miningcore pool whose `coin.symbol` matches.
If your pool IDs differ, or you run several pools per coin, set the **Miningcore pool id** per coin in `/admin`.
Coins with no linked pool show as offline. Untick **enabled** to hide a coin.

In Miningcore mode the **fee, minimum payout, payout scheme and stratum port are read live from Miningcore** and are read-only in the admin panel.
To change them, edit Miningcore's `config.json` and restart Miningcore.

## Update / operate
```bash
sudo bash deploy/install.sh            # re-run after pulling new code: rebuilds + restarts, keeps .env and data
systemctl status minershaven-api       # service state
journalctl -u minershaven-api -f       # API logs
sudo nano /opt/minershaven/backend/.env && sudo systemctl restart minershaven-api   # change settings
```

## `.env` reference (`/opt/minershaven/backend/.env`)
| Key | Meaning |
|---|---|
| `DATA_SOURCE` | `miningcore` (live) or `demo` |
| `MININGCORE_API_URL` | e.g. `http://127.0.0.1:4000` |
| `MININGCORE_CACHE_SECONDS` | API response cache (default 10) |
| `STRATUM_HOST` | hostname shown in miner commands |
| `ADMIN_PASSWORD` | admin passkey for `/admin` |
| `ADMIN_JWT_SECRET` | session signing secret |
| `COOKIE_SECURE` | `true` with HTTPS, `false` for plain HTTP |
| `MONGO_URL`, `DB_NAME`, `CORS_ORIGINS` | database and origin settings |

## Firewall
Open 80/443 for the website. The stratum ports are Miningcore's, so open those too (for example `ufw allow 3052/tcp`).
Keep 4000 (Miningcore API), 8001 (MinersHaven API) and 27017 (MongoDB) closed to the public.

## Run without systemd/nginx (quick local try)
```bash
cd backend && python3 -m venv .venv && .venv/bin/pip install -r requirements.prod.txt
cp .env.example .env   # edit values
.venv/bin/uvicorn server:app --port 8001
cd ../frontend && yarn install && yarn dev    # http://localhost:3000 (proxies /api → 8001)
```
