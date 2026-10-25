// Mirrors backend/models/pool.py — keep in sync by hand.
export interface CoinConfig {
  symbol: string;
  name: string;
  algo: string;
  fee_pct: number;
  min_payout: number;
  enabled: boolean;
  stratum_port: number;
  rpc_url: string;
  block_reward: number;
  price_usd: number;
  payout_scheme: string;
}

export interface CoinUpdate {
  fee_pct?: number;
  min_payout?: number;
  enabled?: boolean;
  stratum_port?: number;
  rpc_url?: string;
}

export interface CoinSummary extends CoinConfig {
  stratum_host: string;
  hashrate: number;
  network_hashrate: number;
  miners: number;
  workers: number;
  blocks_24h: number;
  last_block_at: string | null;
  effort_pct: number;
}

export interface HashratePoint {
  t: string;
  hashrate: number;
}

export interface PoolOverview {
  coins: CoinSummary[];
  total_miners: number;
  total_workers: number;
  blocks_24h: number;
  server_time: string;
}

export interface CoinDetail {
  coin: CoinSummary;
  history: HashratePoint[];
}

export interface Block {
  id: string;
  coin: string;
  height: number;
  hash: string;
  reward: number;
  effort_pct: number;
  status: "confirmed" | "pending" | "orphaned";
  confirmations: number;
  found_by: string;
  found_at: string;
}

export interface Payout {
  id: string;
  coin: string;
  wallet: string;
  amount: number;
  tx_hash: string;
  paid_at: string;
}

export interface Worker {
  name: string;
  hashrate: number;
  shares_valid: number;
  shares_stale: number;
  shares_invalid: number;
  online: boolean;
  last_share_at: string;
}

export interface SampleWallet {
  wallet: string;
  coin: string;
}

export interface MinerDetail {
  wallet: string;
  coin: string;
  hashrate: number;
  hashrate_24h_avg: number;
  balance: number;
  total_paid: number;
  min_payout: number;
  workers: Worker[];
  payouts: Payout[];
  history: HashratePoint[];
}

export interface AdminStatus {
  authenticated: boolean;
}
