# BTC and Litecoin Stratum

This deployment runs Miningcore as a separate pool engine. FastAPI remains the
dashboard/API process; it does not validate shares or handle block submissions.
The existing dashboard telemetry is still simulated and is not sourced from
Miningcore. Dashboard admin settings also do not change this deployment's
ports, payout thresholds, node endpoints, or pool wallets; configure those in
this directory's `.env` and `config.template.json`.

The image builds upstream Miningcore at pinned revision
`a553f62301f44c6df80891e408b6526d1dd98692`. That revision targets .NET 6, which
is out of support. Treat this as an integration baseline, not an audited
production deployment; review and update the engine/runtime before accepting
valuable hashrate or enabling automatic payouts.

## Requirements

- A Linux host with Docker Engine and the Docker Compose plugin.
- Fully synchronized Bitcoin Core and Litecoin Core nodes, each configured for
  authenticated RPC and a wallet available to the pool for block payouts.
- Firewall and DNS access to the host's TCP ports 3333 (BTC) and 3334 (LTC).
- Unique real payout addresses for each coin. Do not use example or demo addresses.

Keep RPC endpoints private and restrict their firewall access to the pool host.
The Stratum ports are public miner-facing services; do not expose the Miningcore
API or PostgreSQL port publicly.

## Configure and run

1. Copy `.env.example` to `.env` in this directory and enter strong database
   and node RPC credentials plus real pool payout addresses. Keep `.env` out of
   version control.
2. Configure both nodes' RPC allowlists to permit connections from the pool
   host. The Compose file maps `host.docker.internal` to the Docker host gateway;
   for remote nodes, replace the example host values with reachable private
   addresses.
3. Start the services with `docker compose --env-file .env up --build -d`.
4. Check startup with `docker compose --env-file .env logs -f miningcore` and
   verify both pools report healthy node connections before directing miners.
5. Open TCP 3333 and 3334 on the pool host and point BTC/LTC miners at
   `stratum+tcp://<pool-host>:3333` or `stratum+tcp://<pool-host>:3334`.

Miningcore's payout processor uses each node wallet. Test on a private network
with valueless funds first. Back up the PostgreSQL volume and both node wallets.

Dogecoin is not included: production DOGE support requires a separately
verified AuxPoW/merge-mining configuration, not just another Scrypt pool entry.