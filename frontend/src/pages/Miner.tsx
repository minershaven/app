import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import Layout from "@/components/Layout";
import CoinBadge from "@/components/CoinBadge";
import HashrateChart from "@/components/HashrateChart";
import WalletSearchBar from "@/components/WalletSearchBar";
import EarningsSection from "@/components/EarningsSection";
import { PayoutsTable, WorkerTable } from "@/components/DataTables";
import { Panel, Stat } from "@/components/Panel";
import { apiGet, ApiError } from "@/lib/api";
import type { MinerDetail } from "@/lib/types";
import { coinStyle, formatCoin, formatHashrate } from "@/lib/format";

export default function Miner() {
  const wallet = useParams().wallet ?? "";
  const { data, error, isError, isLoading } = useQuery({
    queryKey: ["miner", wallet],
    queryFn: () => apiGet<MinerDetail>(`/miners/${encodeURIComponent(wallet)}`),
    refetchInterval: 30_000,
    retry: (n, e) => !(e instanceof ApiError && e.status === 404) && n < 2,
  });
  const m = !isError ? data : undefined;
  const notFound = error instanceof ApiError && error.status === 404;
  const s = coinStyle(m?.coin ?? "");
  const progress = m ? Math.min((m.balance / m.min_payout) * 100, 100) : 0;
  const online = m ? m.workers.filter((w) => w.online).length : 0;

  const copyWallet = async () => {
    try {
      await navigator.clipboard.writeText(wallet);
    } catch {
      /* ignore */
    }
    toast.success("Wallet copied");
  };

  return (
    <Layout>
      <Link to="/" className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground transition-colors duration-150 hover:text-neon" data-testid="miner-back-link">
        ← overview
      </Link>
      <div className="mt-3 animate-rise">
        <div className="flex items-center gap-3">
          {m && <CoinBadge symbol={m.coin} />}
          <span className="font-mono text-[11px] uppercase tracking-[0.25em] text-muted-foreground">miner hud</span>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <h1 data-testid="miner-wallet" className="min-w-0 break-all font-mono text-lg font-semibold text-foreground sm:text-2xl">
            {wallet}
          </h1>
          <button type="button" onClick={copyWallet} aria-label="Copy wallet" data-testid="miner-copy-wallet-button" className="grid size-8 shrink-0 place-items-center rounded-sm border border-line text-muted-foreground transition-colors duration-150 hover:border-neon/60 hover:text-neon">
            <Copy className="size-4" />
          </button>
        </div>
      </div>

      {notFound && (
        <div data-testid="miner-not-found" className="mt-8 space-y-4 rounded-sm border border-dashed border-line p-6">
          <p className="font-mono text-sm text-amber-400">ERR_NO_SHARES — no miner found for this wallet.</p>
          <p className="text-sm text-muted-foreground">Stats appear a few minutes after your first accepted share. Double-check the address or try a demo miner:</p>
          <WalletSearchBar />
        </div>
      )}

      {!notFound && (
        <>
          <section className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat testId="miner-stat-hashrate" label="current hashrate" value={m ? formatHashrate(m.hashrate) : isLoading ? "…" : "—"} accent={s.color} />
            <Stat testId="miner-stat-avg" label="24h average" value={m ? formatHashrate(m.hashrate_24h_avg) : "—"} />
            <Stat testId="miner-stat-workers" label="workers online" value={m ? `${online}/${m.workers.length}` : "—"} accent={m && online < m.workers.length ? "#F59E0B" : undefined} />
            <Stat testId="miner-stat-paid" label="total paid" value={m ? formatCoin(m.total_paid, m.coin) : "—"} />
          </section>

          <section className="mt-6 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
            <Panel title="your hashrate · 24h" testId="miner-chart-panel">
              <HashrateChart data={m ? m.history : []} color={s.color} testId="miner-hashrate-chart" />
            </Panel>
            <Panel title="unpaid balance" testId="miner-balance-panel">
              <div data-testid="miner-balance" className="font-mono text-3xl font-semibold tabular-nums text-neon glow-neon">
                {m ? formatCoin(m.balance, m.coin) : "—"}
              </div>
              <div className="mt-6 h-2 overflow-hidden rounded-sm bg-term">
                <div className="h-full bg-neon transition-[width] duration-700" style={{ width: `${progress}%` }} data-testid="miner-payout-progress" />
              </div>
              <div className="mt-2 flex justify-between font-mono text-[11px] text-muted-foreground">
                <span>{progress.toFixed(1)}% to threshold</span>
                <span>min {m ? formatCoin(m.min_payout, m.coin) : "—"}</span>
              </div>
              <p className="mt-6 font-mono text-[11px] leading-relaxed text-muted-foreground">
                Payouts are sent automatically every 2 hours once your balance crosses the coin's minimum threshold.
              </p>
            </Panel>
          </section>

          <EarningsSection wallet={wallet} enabled={!!m} />

          <Panel className="mt-6" title={`workers · ${m?.workers.length ?? 0}`} testId="miner-workers-panel">
            <WorkerTable workers={m ? m.workers : []} />
          </Panel>
          <Panel className="mt-6" title="payout history" testId="miner-payouts-panel">
            <PayoutsTable payouts={m ? m.payouts : []} showWallet={false} />
          </Panel>
        </>
      )}
    </Layout>
  );
}
