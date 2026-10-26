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
    rpc_url: str = ""
    block_reward: Optional[float] = None
    price_usd: Optional[float] = None
    payout_scheme: str = "PPLNS"
    pool_id: str = ""  # Miningcore pool id; empty = auto-match by coin symbol
    managed_by: Literal["local", "miningcore"] = "local"


class CoinUpdate(BaseModel):
    fee_pct: Optional[float] = Field(default=None, ge=0, le=10)
    min_payout: Optional[float] = Field(default=None, gt=0)
    enabled: Optional[bool] = None
    stratum_port: Optional[int] = Field(default=None, ge=1024, le=65535)
    rpc_url: Optional[str] = Field(default=None, min_length=1)
    pool_id: Optional[str] = None


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
    source: Literal["demo", "miningcore"]


class CoinDetail(BaseModel):
    coin: CoinSummary
    history: List[HashratePoint]


class Block(BaseModel):
    id: str
    coin: str
    height: int
    hash: str
    reward: float
    effort_pct: Optional[float] = None
    status: Literal["confirmed", "pending", "orphaned"]
    confirmation_progress: float  # 0..1
    found_by: str
    found_at: str
    info_link: Optional[str] = None


class Payout(BaseModel):
    id: str
    coin: str
    wallet: str
    amount: float
    tx_hash: str
    paid_at: str
    tx_link: Optional[str] = None


class Worker(BaseModel):
    name: str
    hashrate: float
    shares_per_second: float
    online: bool
    last_share_at: Optional[str] = None


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


class RecentBlocks(BaseModel):
    server_time: str
    blocks: List[Block]


class DailyEarning(BaseModel):
    date: str  # ISO date (UTC day)
    amount: float


class BalanceChange(BaseModel):
    id: str
    amount: float
    usage: str
    created: str


class MinerEarnings(BaseModel):
    wallet: str
    coin: str
    total_30d: float
    daily: List[DailyEarning]
    balance_changes: List[BalanceChange]
