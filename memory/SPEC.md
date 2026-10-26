# MinersHaven — SPEC

Multi-coin crypto mining pool dashboard (BTC, LTC, DOGE, ZANO). Dark hacker theme.
**Dashboard data is SIMULATED demo telemetry** (seeded in Mongo; hashrates jittered deterministically by time). An optional external Miningcore deployment is configured under `deploy/miningcore` for BTC and Litecoin Stratum/PPLNS, but it is not running in this environment and requires external synchronized nodes. The existing dashboard does not yet ingest Miningcore telemetry. DOGE (AuxPoW merge mining) and ZANO remain unimplemented; their displayed Stratum/RPC addresses are placeholders.

## Data sources (backend/.env DATA_SOURCE)
- `demo` (preview default): seeded Mongo data.
- `miningcore`: live data from the Miningcore REST API at MININGCORE_API_URL (lib/sources/miningcore.py). Coins are mapped to Miningcore pools by `pool_id`, set in admin, or auto-matched by coin.symbol. Fee, min payout, port and scheme are read-only there (PUT returns 400). If Miningcore is unreachable, endpoints return 502. Demo sample wallets are empty in this mode.
- To test locally, run the mock Miningcore: `cd backend && uvicorn tests.mock_miningcore:app --port 4000` (test wallet ltc1qtestminer000000000000000000000000000).
- Native production install (no Docker): `sudo bash deploy/install.sh [--domain d --email e] [--demo]`. It sets up systemd (minershaven-api), nginx and local MongoDB 8. See DEPLOY.md.

## Pages
- `/` overview: wallet lookup + demo wallet chips, live share log (client-side simulated), totals, 4 coin cards, stratum quick-connect (command generator per miner software).
- `/coin/:symbol` coin detail: stats, 24h hashrate chart, stratum connect, Blocks/Payouts tabs. Unknown coin → "ERR_UNKNOWN_COIN".
- `/miner/:wallet` miner HUD: hashrate, 24h avg, workers, balance vs min payout, chart, workers table, payout history. Unknown wallet → 404 panel "ERR_NO_SHARES".
- `/admin` password-gated (httpOnly JWT cookie `mh_admin`): edit per-coin fee %, min payout, enabled, stratum port (unique, 1024-65535), node RPC URL. Disabling a coin shows it as "maintenance" with 0 hashrate.

## API (all under /api)
GET /pool/stats, GET /blocks/recent (newest 10 across enabled coins + server_time), GET /miners/{wallet}/earnings (30-day daily + balance changes; 404 unknown), GET /coins/{sym}, GET /coins/{sym}/blocks, GET /coins/{sym}/payouts, GET /miners/samples, GET /miners/{wallet},
POST /admin/login {password}, POST /admin/logout, GET /admin/me, GET /admin/coins (auth), PUT /admin/coins/{sym} (auth, 409 on port clash).

## Block-found banner + earnings
- The overview polls /blocks/recent every 15s. A banner shows the newest block if it was found in the last 30 minutes (server_time based). Dismissing it stores the block id in localStorage `mh-dismissed-block`. A toast appears when a new block arrives while the page is open.
- In demo mode /blocks/recent "mints" blocks lazily, one per expected interval per coin (BTC 2/day, LTC 6, DOGE 40, ZANO 18), backfilling gaps up to 60 per coin. A unique index on (coin, height) stops duplicates.
- The miner page has a daily earnings bar chart (30 days, avg, best) and a balance history list. Miningcore mode uses /miners/{addr}/earnings/daily and /balancechanges.

## Block luck chart
- On the coin page (LuckChart.tsx) this is built in the frontend from /coins/{sym}/blocks, with no new endpoint. It shows one bar per block's effort, oldest to newest. Green means at or under 100% (lucky), amber means over 100%, red means orphaned. Dashed lines mark 100% and the average. Above the chart are stats: avg effort, lucky count, luckiest and unluckiest. Blocks with no effort value are skipped.

## Data (Mongo)
coins, miners (wallet, coin, workers[base_hashrate...], balance, total_paid), blocks, payouts. Seeded on startup if empty; reset with `cd /app/backend && python seed.py`.

## Seed facts
Demo wallets: BTC `bc1qhaven7x9k2m4p8r3t6w0y5z2a8c4e6g9j3l7n`, LTC `ltc1qhvn4s8d2f6h0k3m7p1r5t9w3y7a2c6e0g4j8`, DOGE `DHavenM1n3rS9xQ2wE7rT4yU6iO8pA3sD5fG`, ZANO `ZxHaven5Ns7kQ2mP9rT4wY6uI8oA1sD3fG5hJ7kL9zX2cV4bN6m`. 30 blocks per coin.
Default ports BTC 3333, LTC 3334, DOGE 3335, ZANO 3336.
