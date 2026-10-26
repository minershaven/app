"""Deterministic demo data for MinersHaven (coins, miners, blocks, payouts) + simulated live telemetry."""

import hashlib
import math
import random
import uuid
from datetime import datetime, timedelta, timezone

from lib.db import db

COINS = [
    dict(symbol="BTC", name="Bitcoin", algo="SHA-256", fee_pct=1.0, min_payout=0.005, stratum_port=3333,
         rpc_url="http://127.0.0.1:8332", block_reward=3.125, price_usd=97250.0),
    dict(symbol="LTC", name="Litecoin", algo="Scrypt", fee_pct=0.9, min_payout=0.1, stratum_port=3334,
         rpc_url="http://127.0.0.1:9332", block_reward=6.25, price_usd=104.3),
    dict(symbol="DOGE", name="Dogecoin", algo="Scrypt (AuxPoW)", fee_pct=0.9, min_payout=50.0, stratum_port=3335,
         rpc_url="http://127.0.0.1:22555", block_reward=10000.0, price_usd=0.32),
    dict(symbol="ZANO", name="Zano", algo="ProgPoWZ", fee_pct=1.5, min_payout=0.5, stratum_port=3336,
         rpc_url="http://127.0.0.1:11211", block_reward=1.0, price_usd=1.12),
]

# Per-worker baseline hashrate range (H/s) and network hashrate (H/s)
HASH_RANGES = {
    "BTC": (90e12, 240e12),
    "LTC": (2.5e9, 16e9),
    "DOGE": (2.5e9, 16e9),
    "ZANO": (40e6, 180e6),
}
NETWORK_HASHRATE = {"BTC": 780e18, "LTC": 2.1e15, "DOGE": 2.0e15, "ZANO": 1.9e12}
BLOCKS_PER_DAY = {"BTC": 2, "LTC": 6, "DOGE": 40, "ZANO": 18}

FIXED_WALLETS = {
    "BTC": "bc1qhaven7x9k2m4p8r3t6w0y5z2a8c4e6g9j3l7n",
    "LTC": "ltc1qhvn4s8d2f6h0k3m7p1r5t9w3y7a2c6e0g4j8",
    "DOGE": "DHavenM1n3rS9xQ2wE7rT4yU6iO8pA3sD5fG",
    "ZANO": "ZxHaven5Ns7kQ2mP9rT4wY6uI8oA1sD3fG5hJ7kL9zX2cV4bN6m",
}
WORKER_NAMES = ["rig01", "rig02", "antminer-s21", "l7-bay3", "garage", "gpu-farm", "basement", "hydro-04", "node-a"]
HEX = "0123456789abcdef"
B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat()


def _rand_wallet(rng: random.Random, coin: str) -> str:
    if coin == "BTC":
        return "bc1q" + "".join(rng.choice("023456789acdefghjklmnpqrstuvwxyz") for _ in range(38))
    if coin == "LTC":
        return "ltc1q" + "".join(rng.choice("023456789acdefghjklmnpqrstuvwxyz") for _ in range(38))
    if coin == "DOGE":
        return "D" + "".join(rng.choice(B58) for _ in range(33))
    return "Zx" + "".join(rng.choice(B58) for _ in range(95))


def jitter(seed: str, bucket: int, amp: float = 0.12) -> float:
    """Deterministic noise in [1-amp, 1+amp] for a seed + time bucket."""
    h = int(hashlib.sha256(f"{seed}:{bucket}".encode()).hexdigest()[:8], 16) / 0xFFFFFFFF
    wave = math.sin(bucket / 3.0 + (hash(seed) % 7)) * 0.4
    return 1 + amp * (h * 2 - 1) * 0.6 + amp * wave


def history(seed: str, base: float, points: int = 48, step_minutes: int = 30) -> list[dict]:
    now = now_utc().replace(second=0, microsecond=0)
    out = []
    for i in range(points - 1, -1, -1):
        t = now - timedelta(minutes=step_minutes * i)
        bucket = int(t.timestamp() // (step_minutes * 60))
        out.append({"t": iso(t), "hashrate": round(base * jitter(seed, bucket), 2)})
    return out


def current(seed: str, base: float) -> float:
    bucket = int(now_utc().timestamp() // 60)
    return round(base * jitter(seed, bucket, 0.08), 2)


async def seed_all(force: bool = False) -> None:
    if not force and await db.coins.count_documents({}) > 0:
        return
    for c in ["coins", "miners", "blocks", "payouts"]:
        await db[c].delete_many({})

    rng = random.Random(1337)
    now = now_utc()
    await db.coins.insert_many([{**c, "enabled": True, "payout_scheme": "PPLNS", "pool_id": ""} for c in COINS])

    for coin in COINS:
        sym = coin["symbol"]
        lo, hi = HASH_RANGES[sym]
        wallets = [FIXED_WALLETS[sym]] + [_rand_wallet(rng, sym) for _ in range(rng.randint(14, 22))]
        miners = []
        payouts = []
        for w in wallets:
            n_workers = rng.randint(2, 5) if w == FIXED_WALLETS[sym] else rng.randint(1, 4)
            workers = []
            for name in rng.sample(WORKER_NAMES, n_workers):
                online = rng.random() > 0.12
                workers.append({
                    "name": name,
                    "base_hashrate": rng.uniform(lo, hi) if online else 0.0,
                    "shares_valid": rng.randint(800, 24000),
                    "shares_stale": rng.randint(0, 120),
                    "shares_invalid": rng.randint(0, 25),
                    "online": online,
                    "last_share_at": iso(now - timedelta(seconds=rng.randint(2, 50)) if online
                                         else now - timedelta(hours=rng.randint(2, 30))),
                })
            total_paid = 0.0
            for _ in range(rng.randint(2, 8)):
                amt = round(coin["min_payout"] * rng.uniform(1.0, 3.5), 8)
                total_paid += amt
                payouts.append({
                    "id": str(uuid.uuid4()), "coin": sym, "wallet": w, "amount": amt,
                    "tx_hash": "".join(rng.choice(HEX) for _ in range(64)),
                    "paid_at": iso(now - timedelta(hours=rng.uniform(1, 24 * 14))),
                })
            miners.append({
                "wallet": w, "coin": sym, "workers": workers,
                "balance": round(coin["min_payout"] * rng.uniform(0.05, 0.95), 8),
                "total_paid": round(total_paid, 8),
            })
        await db.miners.insert_many(miners)
        await db.payouts.insert_many(payouts)

        blocks = []
        height = {"BTC": 878_400, "LTC": 2_812_900, "DOGE": 5_520_300, "ZANO": 2_975_100}[sym]
        t = now - timedelta(minutes=rng.randint(4, 40))
        for i in range(30):
            confirmations = int((now - t).total_seconds() // {"BTC": 600, "LTC": 150, "DOGE": 60, "ZANO": 60}[sym])
            status = "orphaned" if rng.random() < 0.04 else ("confirmed" if confirmations >= 100 else "pending")
            blocks.append({
                "id": str(uuid.uuid4()), "coin": sym, "height": height,
                "hash": ("0" * (18 if sym == "BTC" else 6)) + "".join(rng.choice(HEX) for _ in range(64 - (18 if sym == "BTC" else 6))),
                "reward": round(coin["block_reward"] * rng.uniform(1.0, 1.04), 8),
                "effort_pct": round(rng.uniform(18, 210), 1),
                "status": status, "confirmations": min(confirmations, 9999),
                "found_by": rng.choice(wallets), "found_at": iso(t),
            })
            height -= rng.randint(40, 400) if sym == "BTC" else rng.randint(20, 220)
            t -= timedelta(hours=24 / BLOCKS_PER_DAY[sym] * rng.uniform(0.4, 1.6))
        await db.blocks.insert_many(blocks)
