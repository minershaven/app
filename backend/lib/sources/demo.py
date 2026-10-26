"""Demo source: seeded Mongo data + deterministic jittered hashrates."""

from datetime import datetime, timedelta, timezone
from typing import List, Optional

from fastapi import HTTPException

from lib.db import db
from lib.seed_data import NETWORK_HASHRATE, current, history, iso, now_utc
from lib.sources import COIN_ORDER, STRATUM_HOST
from models.pool import Block, CoinConfig, CoinDetail, CoinSummary, HashratePoint, MinerDetail, Payout, PoolOverview, Worker


async def local_coins() -> List[dict]:
    cfgs = await db.coins.find({}, {"_id": 0}).to_list(100)
    cfgs.sort(key=lambda c: COIN_ORDER.get(c["symbol"], 99))
    return cfgs


async def local_coin(symbol: str) -> dict:
    cfg = await db.coins.find_one({"symbol": symbol.upper()}, {"_id": 0})
    if not cfg:
        raise HTTPException(status_code=404, detail="Coin not found")
    return cfg


def _block_from_doc(d: dict) -> Block:
    conf = d.pop("confirmations", 0)
    d.setdefault("confirmation_progress", 1.0 if d["status"] == "confirmed" else min(conf / 100, 1.0))
    return Block(**d)


async def _summary(cfg: dict) -> CoinSummary:
    sym = cfg["symbol"]
    enabled = cfg.get("enabled", True)
    miners = await db.miners.find({"coin": sym}, {"_id": 0, "workers": 1}).to_list(1000)
    base = sum(w["base_hashrate"] for m in miners for w in m["workers"]) if enabled else 0.0
    workers = sum(1 for m in miners for w in m["workers"] if w["online"])
    since = iso(now_utc() - timedelta(hours=24))
    blocks_24h = await db.blocks.count_documents({"coin": sym, "found_at": {"$gte": since}})
    last = await db.blocks.find_one({"coin": sym}, {"_id": 0, "found_at": 1}, sort=[("found_at", -1)])
    effort = 0.0
    if last:
        mins = (now_utc() - datetime.fromisoformat(last["found_at"])).total_seconds() / 60
        effort = round(min(mins / (1440 / max(blocks_24h, 1)) * 100, 999), 1)
    return CoinSummary(
        **CoinConfig(**cfg).model_dump(),
        stratum_host=STRATUM_HOST, hashrate=current(f"pool-{sym}", base) if base else 0.0,
        network_hashrate=NETWORK_HASHRATE.get(sym, 0.0),
        miners=len(miners) if enabled else 0, workers=workers if enabled else 0,
        blocks_24h=blocks_24h, last_block_at=last["found_at"] if last else None, effort_pct=effort,
    )


async def pool_overview() -> PoolOverview:
    coins = [await _summary(c) for c in await local_coins()]
    return PoolOverview(
        coins=coins, total_miners=sum(c.miners for c in coins), total_workers=sum(c.workers for c in coins),
        blocks_24h=sum(c.blocks_24h for c in coins), server_time=iso(now_utc()), source="demo",
    )


async def coin_detail(symbol: str) -> CoinDetail:
    cfg = await local_coin(symbol)
    summary = await _summary(cfg)
    miners = await db.miners.find({"coin": cfg["symbol"]}, {"_id": 0, "workers": 1}).to_list(1000)
    base = sum(w["base_hashrate"] for m in miners for w in m["workers"])
    pts = history(f"pool-{cfg['symbol']}", base) if cfg.get("enabled", True) else []
    return CoinDetail(coin=summary, history=[HashratePoint(**p) for p in pts])


async def coin_blocks(symbol: str) -> List[Block]:
    cfg = await local_coin(symbol)
    docs = await db.blocks.find({"coin": cfg["symbol"]}, {"_id": 0}).sort("found_at", -1).to_list(50)
    return [_block_from_doc(d) for d in docs]


async def coin_payouts(symbol: str) -> List[Payout]:
    cfg = await local_coin(symbol)
    docs = await db.payouts.find({"coin": cfg["symbol"]}, {"_id": 0}).sort("paid_at", -1).to_list(30)
    return [Payout(**d) for d in docs]


async def miner_detail(wallet: str) -> Optional[MinerDetail]:
    m = await db.miners.find_one({"wallet": wallet.strip()}, {"_id": 0})
    if not m:
        return None
    cfg = await local_coin(m["coin"])
    workers = [
        Worker(
            name=w["name"], online=w["online"], last_share_at=w["last_share_at"],
            hashrate=current(f"{wallet}-{w['name']}", w["base_hashrate"]) if w["online"] else 0.0,
            shares_per_second=round(w["shares_valid"] / 86400, 3) if w["online"] else 0.0,
        )
        for w in m["workers"]
    ]
    hist = history(f"miner-{wallet}", sum(w["base_hashrate"] for w in m["workers"]))
    payouts = await db.payouts.find({"wallet": m["wallet"]}, {"_id": 0}).sort("paid_at", -1).to_list(50)
    return MinerDetail(
        wallet=m["wallet"], coin=m["coin"], hashrate=sum(w.hashrate for w in workers),
        hashrate_24h_avg=round(sum(p["hashrate"] for p in hist) / max(len(hist), 1), 2),
        balance=m["balance"], total_paid=m["total_paid"], min_payout=cfg["min_payout"],
        workers=workers, payouts=[Payout(**p) for p in payouts], history=[HashratePoint(**p) for p in hist],
    )


# ---------- live block simulation + earnings (demo only) ----------
import hashlib as _hashlib
import random as _random
import uuid as _uuid

from pymongo.errors import DuplicateKeyError

from lib.seed_data import BLOCKS_PER_DAY, HEX
from models.pool import BalanceChange, DailyEarning, MinerEarnings, RecentBlocks


async def _mint_blocks() -> None:
    """Demo realism: each time a coin's expected block interval elapses the pool 'finds' a block (backfills gaps, max 60/coin)."""
    now = now_utc()
    for cfg in await local_coins():
        if not cfg.get("enabled", True):
            continue
        sym = cfg["symbol"]
        last = await db.blocks.find_one({"coin": sym}, {"_id": 0}, sort=[("found_at", -1)])
        interval = timedelta(hours=24 / BLOCKS_PER_DAY.get(sym, 4))
        height = last["height"] if last else 0
        t = datetime.fromisoformat(last["found_at"]) if last else now - interval
        finders = [m["wallet"] for m in await db.miners.find({"coin": sym}, {"_id": 0, "wallet": 1}).to_list(1000)]
        for _ in range(60):
            rng = _random.Random(f"{sym}-{height + 1}")
            nxt = t + interval * rng.uniform(0.6, 1.4)
            if nxt > now:
                break
            height, t = height + 1, nxt
            zeros = 18 if sym == "BTC" else 6
            try:
                await db.blocks.update_one(
                    {"coin": sym, "height": height},
                    {"$setOnInsert": {
                        "id": str(_uuid.uuid4()), "coin": sym, "height": height,
                        "hash": "0" * zeros + "".join(rng.choice(HEX) for _ in range(64 - zeros)),
                        "reward": round((cfg.get("block_reward") or 1) * rng.uniform(1.0, 1.04), 8),
                        "effort_pct": round(rng.uniform(40, 160), 1), "status": "pending", "confirmations": 0,
                        "found_by": rng.choice(finders) if finders else "", "found_at": iso(t),
                    }},
                    upsert=True,
                )
            except DuplicateKeyError:  # a concurrent request minted it first
                pass


async def recent_blocks() -> RecentBlocks:
    await _mint_blocks()
    enabled = [c["symbol"] for c in await local_coins() if c.get("enabled", True)]
    docs = await db.blocks.find({"coin": {"$in": enabled}}, {"_id": 0}).sort("found_at", -1).to_list(10)
    return RecentBlocks(server_time=iso(now_utc()), blocks=[_block_from_doc(d) for d in docs])


def _unit(seed: str) -> float:
    return int(_hashlib.sha256(seed.encode()).hexdigest()[:8], 16) / 0xFFFFFFFF


async def miner_earnings(wallet: str) -> Optional[MinerEarnings]:
    m = await db.miners.find_one({"wallet": wallet.strip()}, {"_id": 0})
    if not m:
        return None
    cfg = await local_coin(m["coin"])
    sym = m["coin"]
    pool_miners = await db.miners.find({"coin": sym}, {"_id": 0, "workers": 1}).to_list(1000)
    pool_base = sum(w["base_hashrate"] for pm in pool_miners for w in pm["workers"]) or 1
    share = sum(w["base_hashrate"] for w in m["workers"]) / pool_base
    per_day = BLOCKS_PER_DAY.get(sym, 4) * (cfg.get("block_reward") or 1) * share * (1 - cfg["fee_pct"] / 100)
    today = now_utc().replace(hour=0, minute=0, second=0, microsecond=0)
    daily = []
    for i in range(29, -1, -1):
        day = today - timedelta(days=i)
        amt = per_day * (0.55 + 0.9 * _unit(f"{wallet}-{day.date()}"))
        if i == 0:  # today: only the elapsed part of the day
            amt *= (now_utc() - today).total_seconds() / 86400
        daily.append(DailyEarning(date=day.date().isoformat(), amount=round(amt, 8)))

    changes = []
    for d in daily[-10:]:
        changes.append(BalanceChange(id=f"c-{d.date}", amount=d.amount, usage=f"Block rewards · {d.date}",
                                     created=iso(datetime.fromisoformat(d.date).replace(tzinfo=timezone.utc) + timedelta(hours=23, minutes=59))))
    pays = await db.payouts.find({"wallet": m["wallet"]}, {"_id": 0}).sort("paid_at", -1).to_list(10)
    changes += [BalanceChange(id=f"p-{p['id']}", amount=-p["amount"], usage=f"Payout · tx {p['tx_hash'][:10]}…", created=p["paid_at"]) for p in pays]
    changes = [c for c in changes if c.created <= iso(now_utc())]
    changes.sort(key=lambda c: c.created, reverse=True)
    return MinerEarnings(wallet=m["wallet"], coin=sym, total_30d=round(sum(d.amount for d in daily), 8),
                         daily=daily, balance_changes=changes[:20])
