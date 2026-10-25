from typing import List, Literal, Optional

from pydantic import BaseModel, Field


class CoinConfig(BaseModel):
    symbol: str
    name: str
    algo: str
    fee_pct: float
    min_payout: float
    enabled: bool = True
    stratum_port: int
    rpc_url: str
    block_reward: float
    price_usd: float
    payout_scheme: str = "PPLNS"


class CoinUpdate(BaseModel):
    fee_pct: Optional[float] = Field(default=None, ge=0, le=10)
    min_payout: Optional[float] = Field(default=None, gt=0)
    enabled: Optional[bool] = None
    stratum_port: Optional[int] = Field(default=None, ge=1024, le=65535)
    rpc_url: Optional[str] = Field(default=None, min_length=1)


class CoinSummary(CoinConfig):
    stratum_host: str
    hashrate: float
    network_hashrate: float
    miners: int
    workers: int
    blocks_24h: int
    last_block_at: Optional[str] = None
    effort_pct: float


class HashratePoint(BaseModel):
    t: str
    hashrate: float


class PoolOverview(BaseModel):
    coins: List[CoinSummary]
    total_miners: int
    total_workers: int
    blocks_24h: int
    server_time: str


class CoinDetail(BaseModel):
    coin: CoinSummary
    history: List[HashratePoint]


class Block(BaseModel):
    id: str
    coin: str
    height: int
    hash: str
    reward: float
    effort_pct: float
    status: Literal["confirmed", "pending", "orphaned"]
    confirmations: int
    found_by: str
    found_at: str


class Payout(BaseModel):
    id: str
    coin: str
    wallet: str
    amount: float
    tx_hash: str
    paid_at: str


class Worker(BaseModel):
    name: str
    hashrate: float
    shares_valid: int
    shares_stale: int
    shares_invalid: int
    online: bool
    last_share_at: str


class SampleWallet(BaseModel):
    wallet: str
    coin: str


class MinerDetail(BaseModel):
    wallet: str
    coin: str
    hashrate: float
    hashrate_24h_avg: float
    balance: float
    total_paid: float
    min_payout: float
    workers: List[Worker]
    payouts: List[Payout]
    history: List[HashratePoint]


class AdminLogin(BaseModel):
    password: str


class AdminStatus(BaseModel):
    authenticated: bool
