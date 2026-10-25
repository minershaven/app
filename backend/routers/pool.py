from datetime import datetime, timedelta
from typing import List

from fastapi import APIRouter, HTTPException

from lib.db import db
from lib.seed_data import NETWORK_HASHRATE, current, history, iso, now_utc
from models.pool import (
    Block, CoinDetail, CoinSummary, HashratePoint, MinerDetail, Payout, PoolOverview, SampleWallet, Worker,
)
from lib.seed_data import FIXED_WALLETS

router = APIRouter()
STRATUM_HOST = "stratum.minershaven.io"


async def _coin_summary(cfg: dict) -> CoinSummary:
    sym = cfg["symbol"]
    miners = await db.miners.find({"coin": sym}, {"_id": 0, "workers": 1}).to_list(1000)
    base = sum(w["base_hashrate"] for m in miners for w in m["workers"]) if cfg.get("enabled", True) else 0.0
    workers = sum(1 for m in miners for w in m["workers"] if w["online"])
    since = iso(now_utc() - timedelta(hours=24))
    blocks_24h = await db.blocks.count_documents({"coin": sym, "found_at": {"$gte": since}})
    last = await db.blocks.find_one({"coin": sym}, {"_id": 0, "found_at": 1}, sort=[("found_at", -1)])
    hr = current(f"pool-{sym}", base) if base else 0.0
    # effort since last block: grows with time since last block
    effort = 0.0
    if last:
        mins = (now_utc() - datetime.fromisoformat(last["found_at"])).total_seconds() / 60
        effort = round(min(mins / (1440 / max(blocks_24h, 1)) * 100, 999), 1)
    return CoinSummary(
        **{k: v for k, v in cfg.items() if k != "_id"},
        stratum_host=STRATUM_HOST, hashrate=hr, network_hashrate=NETWORK_HASHRATE[sym],
        miners=len(miners) if cfg.get("enabled", True) else 0, workers=workers if cfg.get("enabled", True) else 0,
        blocks_24h=blocks_24h, last_block_at=last["found_at"] if last else None, effort_pct=effort,
    )


async def _get_coin_cfg(symbol: str) -> dict:
    cfg = await db.coins.find_one({"symbol": symbol.upper()}, {"_id": 0})
    if not cfg:
        raise HTTPException(status_code=404, detail="Coin not found")
    return cfg


@router.get("/pool/stats", response_model=PoolOverview)
async def pool_stats():
    cfgs = await db.coins.find({}, {"_id": 0}).to_list(100)
    order = {"BTC": 0, "LTC": 1, "DOGE": 2, "ZANO": 3}
    cfgs.sort(key=lambda c: order.get(c["symbol"], 99))
    coins = [await _coin_summary(c) for c in cfgs]
    return PoolOverview(
        coins=coins, total_miners=sum(c.miners for c in coins), total_workers=sum(c.workers for c in coins),
        blocks_24h=sum(c.blocks_24h for c in coins), server_time=iso(now_utc()),
    )


@router.get("/coins/{symbol}", response_model=CoinDetail)
async def coin_detail(symbol: str):
    cfg = await _get_coin_cfg(symbol)
    summary = await _coin_summary(cfg)
    miners = await db.miners.find({"coin": cfg["symbol"]}, {"_id": 0, "workers": 1}).to_list(1000)
    base = sum(w["base_hashrate"] for m in miners for w in m["workers"])
    pts = history(f"pool-{cfg['symbol']}", base) if cfg.get("enabled", True) else []
    return CoinDetail(coin=summary, history=[HashratePoint(**p) for p in pts])


@router.get("/coins/{symbol}/blocks", response_model=List[Block])
async def coin_blocks(symbol: str):
    cfg = await _get_coin_cfg(symbol)
    docs = await db.blocks.find({"coin": cfg["symbol"]}, {"_id": 0}).sort("found_at", -1).to_list(50)
    return [Block(**d) for d in docs]


@router.get("/coins/{symbol}/payouts", response_model=List[Payout])
async def coin_payouts(symbol: str):
    cfg = await _get_coin_cfg(symbol)
    docs = await db.payouts.find({"coin": cfg["symbol"]}, {"_id": 0}).sort("paid_at", -1).to_list(30)
    return [Payout(**d) for d in docs]


@router.get("/miners/samples", response_model=List[SampleWallet])
async def sample_wallets():
    return [SampleWallet(wallet=w, coin=c) for c, w in FIXED_WALLETS.items()]


@router.get("/miners/{wallet}", response_model=MinerDetail)
async def miner_detail(wallet: str):
    m = await db.miners.find_one({"wallet": wallet.strip()}, {"_id": 0})
    if not m:
        raise HTTPException(status_code=404, detail="No miner found for this wallet")
    cfg = await _get_coin_cfg(m["coin"])
    workers = [
        Worker(**{k: v for k, v in w.items() if k != "base_hashrate"},
               hashrate=current(f"{wallet}-{w['name']}", w["base_hashrate"]) if w["online"] else 0.0)
        for w in m["workers"]
    ]
    base = sum(w["base_hashrate"] for w in m["workers"])
    hist = history(f"miner-{wallet}", base)
    payouts = await db.payouts.find({"wallet": m["wallet"]}, {"_id": 0}).sort("paid_at", -1).to_list(50)
    return MinerDetail(
        wallet=m["wallet"], coin=m["coin"], hashrate=sum(w.hashrate for w in workers),
        hashrate_24h_avg=round(sum(p["hashrate"] for p in hist) / max(len(hist), 1), 2),
        balance=m["balance"], total_paid=m["total_paid"], min_payout=cfg["min_payout"],
        workers=workers, payouts=[Payout(**p) for p in payouts], history=[HashratePoint(**p) for p in hist],
    )
