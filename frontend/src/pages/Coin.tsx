import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import Layout from "@/components/Layout";
import CoinBadge from "@/components/CoinBadge";
import HashrateChart from "@/components/HashrateChart";
import StratumConnect from "@/components/StratumConnect";
import WalletSearchBar from "@/components/WalletSearchBar";
import { BlocksTable, PayoutsTable } from "@/components/DataTables";
import { Panel, Stat } from "@/components/Panel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiGet, ApiError } from "@/lib/api";
import type { Block, CoinDetail, Payout } from "@/lib/types";
import { ago, coinStyle, formatCoin, formatHashrate, formatInt, formatUsd } from "@/lib/format";

export default function Coin() {
  const symbol = (useParams().symbol ?? "BTC").toUpperCase();
  const s = coinStyle(symbol);
  const detail = useQuery({
    queryKey: ["coin", symbol],
    queryFn: () => apiGet<CoinDetail>(`/coins/${symbol}`),
    refetchInterval: 30_000,
  });
  const blocks = useQuery({ queryKey: ["coin", symbol, "blocks"], queryFn: () => apiGet<Block[]>(`/coins/${symbol}/blocks`) });
  const payouts = useQuery({ queryKey: ["coin", symbol, "payouts"], queryFn: () => apiGet<Payout[]>(`/coins/${symbol}/payouts`) });

  const coin = !detail.isError ? detail.data?.coin : undefined;
  const notFound = detail.error instanceof ApiError && detail.error.status === 404;
  const share = coin && coin.network_hashrate ? (coin.hashrate / coin.network_hashrate) * 100 : 0;

  return (
    <Layout>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="animate-rise">
          <Link to="/" className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground transition-colors duration-150 hover:text-neon" data-testid="coin-back-link">
            ← all pools
          </Link>
          <div className="mt-3 flex items-center gap-3">
            <CoinBadge symbol={symbol} />
            {coin && (
              <span data-testid="coin-status" className={`font-mono text-[10px] uppercase tracking-wider ${coin.enabled ? "text-neon" : "text-red-400"}`}>
                ● {coin.enabled ? "online" : "maintenance"}
              </span>
            )}
          </div>
          <h1 data-testid="coin-title" className="mt-2 font-heading text-4xl font-bold tracking-tight sm:text-5xl">
            {coin?.name ?? symbol} <span className="text-muted-foreground">pool</span>
          </h1>
          {coin && (
            <p className="mt-1 font-mono text-xs text-muted-foreground">
              {coin.algo} · {coin.payout_scheme} · fee {coin.fee_pct}% · min payout {formatCoin(coin.min_payout, symbol)}{coin.price_usd != null && ` · ${formatUsd(coin.price_usd)}`}
            </p>
          )}
        </div>
        <div className="w-full max-w-md"><WalletSearchBar showSamples={false} /></div>
      </div>

      {notFound && (
        <div data-testid="coin-not-found" className="mt-10 rounded-sm border border-dashed border-line p-8 font-mono text-sm text-muted-foreground">
          ERR_UNKNOWN_COIN — {symbol} is not mined on MinersHaven.
        </div>
      )}

      <section className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat testId="coin-stat-hashrate" label="pool hashrate" value={coin ? formatHashrate(coin.hashrate) : "—"} accent={s.color} />
        <Stat testId="coin-stat-network" label="network" value={coin ? formatHashrate(coin.network_hashrate) : "—"} sub={coin ? `pool share ${share.toFixed(share < 0.01 ? 5 : 3)}%` : undefined} />
        <Stat testId="coin-stat-miners" label="miners / workers" value={coin ? `${formatInt(coin.miners)} / ${formatInt(coin.workers)}` : "—"} />
        <Stat testId="coin-stat-blocks" label="blocks 24h" value={coin ? coin.blocks_24h : "—"} sub={coin ? `last ${ago(coin.last_block_at)}` : undefined} />
        <Stat testId="coin-stat-effort" label="round effort" value={coin ? `${coin.effort_pct.toFixed(1)}%` : "—"} accent={coin && coin.effort_pct > 100 ? "#F59E0B" : "#00FF66"} />
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <Panel title="pool hashrate · 24h" testId="coin-chart-panel">
          <HashrateChart data={detail.data && !detail.isError ? detail.data.history : []} color={s.color} testId="coin-hashrate-chart" />
        </Panel>
        <Panel title="connect your rig" testId="coin-connect-panel">
          {coin?.enabled ? (
            <StratumConnect coin={coin} />
          ) : (
            <div data-testid="coin-connect-disabled" className="font-mono text-xs text-muted-foreground">
              {coin ? "Stratum is paused for maintenance. Check back soon." : "Loading stratum config…"}
            </div>
          )}
        </Panel>
      </section>

      <Panel className="mt-6" testId="coin-activity-panel">
        <Tabs defaultValue="blocks">
          <TabsList variant="line" className="mb-3">
            <TabsTrigger value="blocks" data-testid="coin-tab-blocks" className="font-mono text-xs uppercase">Blocks</TabsTrigger>
            <TabsTrigger value="payouts" data-testid="coin-tab-payouts" className="font-mono text-xs uppercase">Payouts</TabsTrigger>
          </TabsList>
          <TabsContent value="blocks">
            <BlocksTable blocks={blocks.data && !blocks.isError ? blocks.data : []} />
          </TabsContent>
          <TabsContent value="payouts">
            <PayoutsTable payouts={payouts.data && !payouts.isError ? payouts.data : []} />
          </TabsContent>
        </Tabs>
      </Panel>
    </Layout>
  );
}
