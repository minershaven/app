# MinersHaven — SPEC

Multi-coin crypto mining pool dashboard (BTC, LTC, DOGE, ZANO). Dark hacker theme.
**Data is SIMULATED demo telemetry** (seeded in Mongo; hashrates jittered deterministically by time). No real stratum server / coin nodes run in this environment — stratum URLs (stratum.minershaven.io:3333-3336) and node RPC URLs are config values only.

## Pages
- `/` overview: wallet lookup + demo wallet chips, live share log (client-side simulated), totals, 4 coin cards, stratum quick-connect (command generator per miner software).
- `/coin/:symbol` coin detail: stats, 24h hashrate chart, stratum connect, Blocks/Payouts tabs. Unknown coin → "ERR_UNKNOWN_COIN".
- `/miner/:wallet` miner HUD: hashrate, 24h avg, workers, balance vs min payout, chart, workers table, payout history. Unknown wallet → 404 panel "ERR_NO_SHARES".
- `/admin` password-gated (httpOnly JWT cookie `mh_admin`): edit per-coin fee %, min payout, enabled, stratum port (unique, 1024-65535), node RPC URL. Disabling a coin shows it as "maintenance" with 0 hashrate.

## API (all under /api)
GET /pool/stats, GET /coins/{sym}, GET /coins/{sym}/blocks, GET /coins/{sym}/payouts, GET /miners/samples, GET /miners/{wallet},
POST /admin/login {password}, POST /admin/logout, GET /admin/me, GET /admin/coins (auth), PUT /admin/coins/{sym} (auth, 409 on port clash).

## Data (Mongo)
coins, miners (wallet, coin, workers[base_hashrate...], balance, total_paid), blocks, payouts. Seeded on startup if empty; reset with `cd /app/backend && python seed.py`.

## Seed facts
Demo wallets: BTC `bc1qhaven7x9k2m4p8r3t6w0y5z2a8c4e6g9j3l7n`, LTC `ltc1qhvn4s8d2f6h0k3m7p1r5t9w3y7a2c6e0g4j8`, DOGE `DHavenM1n3rS9xQ2wE7rT4yU6iO8pA3sD5fG`, ZANO `ZxHaven5Ns7kQ2mP9rT4wY6uI8oA1sD3fG5hJ7kL9zX2cV4bN6m`. 30 blocks per coin.
Default ports BTC 3333, LTC 3334, DOGE 3335, ZANO 3336.
