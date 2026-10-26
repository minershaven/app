"""Miningcore source: maps the Miningcore REST API (https://github.com/oliverw/miningcore/wiki/API) to MinersHaven models.

Config (backend/.env):
  DATA_SOURCE=miningcore
  MININGCORE_API_URL=http://127.0.0.1:4000
Each local coin (BTC/LTC/DOGE/ZANO) maps to a Miningcore pool by its `pool_id` (set in admin),
or — when empty — by matching the pool's coin.symbol.
"""

import asyncio
import hashlib
import os
import time
from datetime import datetime, timedelta, timezone
from typing import Any, List, Optional

import httpx
from fastapi import HTTPException

from lib.seed_data import iso, now_utc
from lib.sources import STRATUM_HOST
from lib.sources.demo import local_coin, local_coins
from models.pool import BalanceChange, Block, CoinConfig, DailyEarning, MinerEarnings, RecentBlocks, CoinDetail, CoinSummary, HashratePoint, MinerDetail, Payout, PoolOverview, Worker

_CACHE: dict[str, tuple[float, Any]] = {}
_TTL = float(os.environ.get("MININGCORE_CACHE_SECONDS", "10"))
_client: Optional[httpx.AsyncClient] = None


def _base() -> str:
    return os.environ.get("MININGCORE_API_URL", "http://127.0.0.1:4000").rstrip("/")


def _http() -> httpx.AsyncClient:
    global _client
    if _client is None:
        _client = httpx.AsyncClient(timeout=8.0)
    return _client


async def _get(path: str, allow_404: bool = False) -> Any:
    url = f"{_base()}{path}"
    hit = _CACHE.get(url)
    if hit and time.monotonic() - hit[0] < _TTL:
        return hit[1]
    try:
        r = await _http().get(url)
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"Miningcore API unreachable at {_base()}: {e.__class__.__name__}")
    if r.status_code == 404 and allow_404:
        return None
    if r.status_code >= 400:
        raise HTTPException(status_code=502, detail=f"Miningcore API error {r.status_code} on {path}")
    data = r.json()
    _CACHE[url] = (time.monotonic(), data)
    return data


def _iso(v: Optional[str]) -> Optional[str]:
    if not v:
        return None
    try:
        dt = datetime.fromisoformat(v.replace("Z", "+00:00"))
    except ValueError:
        return v
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return iso(dt)


async def _pools() -> List[dict]:
    data = await _get("/api/pools")
    return data.get("pools", []) if isinstance(data, dict) else []


def _match(cfg: dict, pools: List[dict]) -> Optional[dict]:
    pid = (cfg.get("pool_id") or "").strip()
    if pid:
        return next((p for p in pools if p.get("id") == pid), None)
    sym = cfg["symbol"].upper()
    return next((p for p in pools if str((p.get("coin") or {}).get("symbol", "")).upper() == sym), None)


def _first_port(pool: dict) -> Optional[int]:
    ports = sorted(int(k) for k in (pool.get("ports") or {}).keys() if str(k).isdigit())
    return ports[0] if ports else None


def merged_config(cfg: dict, pool: Optional[dict]) -> CoinConfig:
    """Local settings (enabled, pool_id) + live values from Miningcore."""
    if not pool:
        return CoinConfig(**{**cfg, "managed_by": "miningcore"})
    coin = pool.get("coin") or {}
    pay = pool.get("paymentProcessing") or {}
    return CoinConfig(
        symbol=cfg["symbol"], name=coin.get("name") or cfg["name"], algo=coin.get("algorithm") or cfg["algo"],
        fee_pct=float(pool.get("poolFeePercent", cfg["fee_pct"]) or 0),
        min_payout=float(pay.get("minimumPayment", cfg["min_payout"]) or cfg["min_payout"]),
        enabled=cfg.get("enabled", True), stratum_port=_first_port(pool) or cfg["stratum_port"],
        rpc_url=f"{_base()}/api/pools/{pool.get('id')}", block_reward=None, price_usd=None,
        payout_scheme=str(pay.get("payoutScheme") or cfg.get("payout_scheme", "PPLNS")).upper(),
        pool_id=pool.get("id", ""), managed_by="miningcore",
    )


async def _recent_blocks(pool_id: str) -> List[dict]:
    data = await _get(f"/api/pools/{pool_id}/blocks?page=0&pageSize=50")
    return data if isinstance(data, list) else []


async def _summary(cfg: dict, pool: Optional[dict]) -> CoinSummary:
    base = merged_config(cfg, pool)
    enabled = base.enabled and pool is not None
    if not enabled:
        return CoinSummary(**{**base.model_dump(), "enabled": False}, stratum_host=STRATUM_HOST, hashrate=0, network_hashrate=0,
                           miners=0, workers=0, blocks_24h=0, last_block_at=None, effort_pct=0)
    ps = pool.get("poolStats") or {}
    ns = pool.get("networkStats") or {}
    blocks = await _recent_blocks(pool["id"])
    since = now_utc() - timedelta(hours=24)
    b24 = sum(1 for b in blocks if (t := _iso(b.get("created"))) and datetime.fromisoformat(t) >= since)
    miners_list = await _get(f"/api/pools/{pool['id']}/miners?page=0&pageSize=1000")
    return CoinSummary(
        **base.model_dump(), stratum_host=STRATUM_HOST,
        hashrate=float(ps.get("poolHashrate") or 0), network_hashrate=float(ns.get("networkHashrate") or 0),
        miners=len(miners_list) if isinstance(miners_list, list) else 0,
        workers=int(ps.get("connectedMiners") or 0), blocks_24h=b24,
        last_block_at=_iso(pool.get("lastPoolBlockTime")), effort_pct=round(float(pool.get("poolEffort") or 0) * 100, 1),
    )


async def _cfg_pool(symbol: str) -> tuple[dict, Optional[dict]]:
    cfg = await local_coin(symbol)
    return cfg, _match(cfg, await _pools())


async def pool_overview() -> PoolOverview:
    pools = await _pools()
    coins = list(await asyncio.gather(*[_summary(c, _match(c, pools)) for c in await local_coins()]))
    return PoolOverview(
        coins=coins, total_miners=sum(c.miners for c in coins), total_workers=sum(c.workers for c in coins),
        blocks_24h=sum(c.blocks_24h for c in coins), server_time=iso(now_utc()), source="miningcore",
    )


async def coin_detail(symbol: str) -> CoinDetail:
    cfg, pool = await _cfg_pool(symbol)
    summary = await _summary(cfg, pool)
    hist: List[HashratePoint] = []
    if pool and summary.enabled:
        perf = await _get(f"/api/pools/{pool['id']}/performance")
        for s in (perf or {}).get("stats", []):
            if t := _iso(s.get("created")):
                hist.append(HashratePoint(t=t, hashrate=float(s.get("poolHashrate") or 0)))
    return CoinDetail(coin=summary, history=hist)


def _status(v: Any) -> str:
    s = str(v or "pending").lower()
    return s if s in ("confirmed", "pending", "orphaned") else "pending"


def _id(*parts: Any) -> str:
    return hashlib.sha1("|".join(str(p) for p in parts).encode()).hexdigest()[:16]


async def coin_blocks(symbol: str) -> List[Block]:
    cfg, pool = await _cfg_pool(symbol)
    if not pool:
        return []
    out = []
    for b in await _recent_blocks(pool["id"]):
        eff = b.get("effort")
        out.append(Block(
            id=_id(pool["id"], b.get("blockHeight"), b.get("hash")), coin=cfg["symbol"], height=int(b.get("blockHeight") or 0),
            hash=b.get("hash") or "", reward=float(b.get("reward") or 0),
            effort_pct=round(float(eff) * 100, 1) if eff is not None else None,
            status=_status(b.get("status")), confirmation_progress=float(b.get("confirmationProgress") or 0),
            found_by=b.get("miner") or "", found_at=_iso(b.get("created")) or iso(now_utc()), info_link=b.get("infoLink") or None,
        ))
    return out


def _payout(p: dict, sym: str) -> Payout:
    tx = p.get("transactionConfirmationData") or ""
    return Payout(
        id=_id(p.get("address"), tx, p.get("created")), coin=sym, wallet=p.get("address") or "",
        amount=float(p.get("amount") or 0), tx_hash=tx, paid_at=_iso(p.get("created")) or "",
        tx_link=p.get("transactionInfoLink") or None,
    )


async def coin_payouts(symbol: str) -> List[Payout]:
    cfg, pool = await _cfg_pool(symbol)
    if not pool:
        return []
    data = await _get(f"/api/pools/{pool['id']}/payments?page=0&pageSize=30")
    return [_payout(p, cfg["symbol"]) for p in (data or [])]


def _sum_workers(sample: Optional[dict]) -> float:
    return sum(float((w or {}).get("hashrate") or 0) for w in ((sample or {}).get("workers") or {}).values())


async def _find_miner(wallet: str) -> Optional[tuple[dict, dict, dict]]:
    """First enabled coin whose Miningcore pool knows this address → (local cfg, pool, miner stats)."""
    pools = await _pools()
    for cfg in await local_coins():
        pool = _match(cfg, pools)
        if not pool or not cfg.get("enabled", True):
            continue
        stats = await _get(f"/api/pools/{pool['id']}/miners/{wallet}", allow_404=True)
        if not stats:
            continue
        perf = stats.get("performance") or {}
        active = bool(perf.get("workers")) or bool(stats.get("performanceSamples")) \
            or float(stats.get("pendingShares") or 0) > 0 or float(stats.get("pendingBalance") or 0) > 0 \
            or float(stats.get("totalPaid") or 0) > 0
        if active:
            return cfg, pool, stats
    return None


async def miner_detail(wallet: str) -> Optional[MinerDetail]:
    wallet = wallet.strip()
    found = await _find_miner(wallet)
    if not found:
        return None
    cfg, pool, stats = found
    perf = stats.get("performance") or {}
    samples = stats.get("performanceSamples") or []
    perf_time = _iso(perf.get("created"))
    workers: dict[str, Worker] = {}
    for s in samples:  # offline workers: seen in history, absent now
        for name in (s.get("workers") or {}):
            workers[name or "default"] = Worker(name=name or "default", hashrate=0, shares_per_second=0, online=False,
                                                 last_share_at=_iso(s.get("created")))
    for name, w in (perf.get("workers") or {}).items():
        workers[name or "default"] = Worker(
            name=name or "default", hashrate=float(w.get("hashrate") or 0),
            shares_per_second=float(w.get("sharesPerSecond") or 0), online=True, last_share_at=perf_time,
        )
    hist = [HashratePoint(t=t, hashrate=_sum_workers(s)) for s in samples if (t := _iso(s.get("created")))]
    pays = await _get(f"/api/pools/{pool['id']}/miners/{wallet}/payments?page=0&pageSize=50") or []
    cc = merged_config(cfg, pool)
    return MinerDetail(
        wallet=wallet, coin=cfg["symbol"], hashrate=_sum_workers(perf),
        hashrate_24h_avg=round(sum(p.hashrate for p in hist) / len(hist), 2) if hist else _sum_workers(perf),
        balance=float(stats.get("pendingBalance") or 0), total_paid=float(stats.get("totalPaid") or 0),
        min_payout=cc.min_payout, workers=sorted(workers.values(), key=lambda w: (not w.online, w.name)),
        payouts=[_payout(p, cfg["symbol"]) for p in pays], history=hist,
    )


async def miner_earnings(wallet: str) -> Optional[MinerEarnings]:
    wallet = wallet.strip()
    found = await _find_miner(wallet)
    if not found:
        return None
    cfg, pool, _ = found
    base = f"/api/pools/{pool['id']}/miners/{wallet}"
    daily_raw, changes_raw = await asyncio.gather(
        _get(f"{base}/earnings/daily?page=0&pageSize=30", allow_404=True),
        _get(f"{base}/balancechanges?page=0&pageSize=20", allow_404=True),
    )
    daily = []
    for d in daily_raw or []:
        day = (_iso(d.get("date")) or "")[:10]
        if day:
            daily.append(DailyEarning(date=day, amount=float(d.get("amount") or 0)))
    daily.sort(key=lambda d: d.date)
    changes = [
        BalanceChange(id=_id(c.get("created"), c.get("amount"), c.get("usage")), amount=float(c.get("amount") or 0),
                      usage=c.get("usage") or "", created=_iso(c.get("created")) or "")
        for c in changes_raw or []
    ]
    changes.sort(key=lambda c: c.created, reverse=True)
    return MinerEarnings(wallet=wallet, coin=cfg["symbol"], total_30d=round(sum(d.amount for d in daily), 8),
                         daily=daily, balance_changes=changes)


async def recent_blocks() -> RecentBlocks:
    coins = [c for c in await local_coins() if c.get("enabled", True)]
    lists = await asyncio.gather(*[coin_blocks(c["symbol"]) for c in coins])
    blocks = sorted((b for lst in lists for b in lst), key=lambda b: b.found_at, reverse=True)[:10]
    return RecentBlocks(server_time=iso(now_utc()), blocks=blocks)


async def admin_coins() -> List[CoinConfig]:
    try:
        pools = await _pools()
    except HTTPException:
        pools = []
    return [merged_config(c, _match(c, pools)) for c in await local_coins()]
