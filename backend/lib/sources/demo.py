"""Demo source: seeded Mongo data + deterministic jittered hashrates."""

from datetime import datetime, timedelta
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
