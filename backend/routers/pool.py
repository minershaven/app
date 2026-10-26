from typing import List

from fastapi import APIRouter, HTTPException

from lib.seed_data import FIXED_WALLETS
from lib.sources import get_source, source_name
from models.pool import Block, CoinDetail, MinerDetail, Payout, PoolOverview, SampleWallet

router = APIRouter()


@router.get("/pool/stats", response_model=PoolOverview)
async def pool_stats():
    return await get_source().pool_overview()


@router.get("/coins/{symbol}", response_model=CoinDetail)
async def coin_detail(symbol: str):
    return await get_source().coin_detail(symbol)


@router.get("/coins/{symbol}/blocks", response_model=List[Block])
async def coin_blocks(symbol: str):
    return await get_source().coin_blocks(symbol)


@router.get("/coins/{symbol}/payouts", response_model=List[Payout])
async def coin_payouts(symbol: str):
    return await get_source().coin_payouts(symbol)


@router.get("/miners/samples", response_model=List[SampleWallet])
async def sample_wallets():
    # Demo wallets only exist in demo mode
    if source_name() != "demo":
        return []
    return [SampleWallet(wallet=w, coin=c) for c, w in FIXED_WALLETS.items()]


@router.get("/miners/{wallet}", response_model=MinerDetail)
async def miner_detail(wallet: str):
    m = await get_source().miner_detail(wallet)
    if not m:
        raise HTTPException(status_code=404, detail="No miner found for this wallet")
    return m
