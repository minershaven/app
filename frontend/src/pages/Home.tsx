import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { ArrowUpRight } from "lucide-react";
import Layout from "@/components/Layout";
import WalletSearchBar from "@/components/WalletSearchBar";
import CoinBadge from "@/components/CoinBadge";
import StratumConnect from "@/components/StratumConnect";
import { Panel, Stat } from "@/components/Panel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiGet } from "@/lib/api";
import type { CoinSummary, PoolOverview } from "@/lib/types";
import { ago, coinStyle, formatHashrate, formatInt, formatUsd } from "@/lib/format";

const LOG_WORKERS = ["rig01", "antminer-s21", "l7-bay3", "gpu-farm", "hydro-04", "garage"];

function TerminalFeed({ coins }: { coins: CoinSummary[] }) {
  const [lines, setLines] = useState<string[]>([]);
  useEffect(() => {
    const active = coins.filter((c) => c.enabled);
    if (!active.length) return;
    const id = setInterval(() => {
      const c = active[Math.floor(Math.random() * active.length)];
      const w = LOG_WORKERS[Math.floor(Math.random() * LOG_WORKERS.length)];
      const diff = 2 ** (14 + Math.floor(Math.random() * 6));
      const ts = new Date().toLocaleTimeString("en-US", { hour12: false });
      const ok = Math.random() > 0.04;
      const line = `${ts} [${c.symbol.padEnd(4)}] ${ok ? "share accepted" : "share STALE   "} ${w.padEnd(13)} diff ${diff}`;
      setLines((l) => [...l.slice(-9), line]);
    }, 900);
    return () => clearInterval(id);
  }, [coins]);

  return (
    <div data-testid="terminal-feed" className="h-64 overflow-hidden rounded-sm border border-line bg-term p-4 font-mono text-[11px] leading-6 scanlines animate-flicker">
      <div className="mb-1 text-muted-foreground">minershaven@stratum:~$ tail -f shares.log</div>
      {lines.map((l, i) => (
        <div key={`${l}-${i}`} className={l.includes("STALE") ? "text-amber-400" : "text-neon/90"}>
          {l}
        </div>
      ))}
      <span className="inline-block h-3.5 w-1.5 animate-blink bg-neon" />
    </div>
  );
}

function CoinCard({ c, i }: { c: CoinSummary; i: number }) {
  const s = coinStyle(c.symbol);
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06, duration: 0.35 }}>
      <Link
        to={`/coin/${c.symbol}`}
        data-testid={`coin-card-${c.symbol.toLowerCase()}`}
        className="group relative block overflow-hidden rounded-sm border border-line bg-panel/90 p-5 transition-[border-color,box-shadow] duration-200 hover:shadow-[0_0_0_1px_var(--c),0_0_28px_-8px_var(--c)]"
        style={{ ["--c" as string]: `${s.color}88` }}
      >
        <div className="absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg, ${s.color}, transparent)` }} />
        <div className="flex items-start justify-between">
          <div>
            <CoinBadge symbol={c.symbol} />
            <div className="mt-2 font-heading text-xl font-semibold">{c.name}</div>
            <div className="font-mono text-[11px] text-muted-foreground">{c.algo} · {c.payout_scheme} {c.fee_pct}%</div>
          </div>
          <span className={`flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider ${c.enabled ? "text-neon" : "text-red-400"}`}>
            <span className={`size-1.5 rounded-full ${c.enabled ? "animate-pulse bg-neon" : "bg-red-500"}`} />
            {c.enabled ? "online" : "maintenance"}
          </span>
        </div>
        <div className="mt-5 font-mono text-2xl font-semibold tabular-nums tracking-tight" style={{ color: s.color }} data-testid={`coin-card-${c.symbol.toLowerCase()}-hashrate`}>
          {formatHashrate(c.hashrate)}
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 border-t border-line pt-3 font-mono text-[11px]">
          <div><div className="text-muted-foreground">miners</div><div className="tabular-nums">{formatInt(c.miners)}</div></div>
          <div><div className="text-muted-foreground">blocks 24h</div><div className="tabular-nums">{c.blocks_24h}</div></div>
          <div><div className="text-muted-foreground">port</div><div className="tabular-nums">{c.stratum_port}</div></div>
        </div>
        <div className="mt-3 flex items-center justify-between font-mono text-[11px] text-muted-foreground">
          <span>last block {ago(c.last_block_at)}</span>
          <span>{formatUsd(c.price_usd)}</span>
        </div>
        <ArrowUpRight className="absolute bottom-4 right-4 size-4 text-muted-foreground opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
      </Link>
    </motion.div>
  );
}

export default function Home() {
  const { data, isError, isLoading } = useQuery({
    queryKey: ["pool-stats"],
    queryFn: () => apiGet<PoolOverview>("/pool/stats"),
    refetchInterval: 30_000,
  });
  const coins = !isError && data ? data.coins : [];
  const online = coins.filter((c) => c.enabled);

  return (
    <Layout>
      <section className="grid items-start gap-8 lg:grid-cols-[1.25fr_1fr]">
        <div className="animate-rise">
          <div className="font-mono text-[11px] uppercase tracking-[0.3em] text-neon">// multi-coin pplns pool · est. 2026</div>
          <h1 className="mt-4 font-heading text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
            Four chains.<br />
            One <span className="text-neon glow-neon">haven</span> for your hash.
          </h1>
          <p className="mt-5 max-w-xl text-base text-muted-foreground">
            Point your ASICs and GPUs at MinersHaven and mine Bitcoin, Litecoin, Dogecoin and Zano with low fees, vardiff stratum and
            automatic payouts. No account — your wallet is your login.
          </p>
          <div className="mt-8 max-w-2xl">
            <WalletSearchBar />
          </div>
        </div>
        <TerminalFeed coins={coins} />
      </section>

      <section className="mt-12 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat testId="stat-total-miners" label="active miners" value={isLoading ? "…" : formatInt(data?.total_miners ?? 0)} />
        <Stat testId="stat-total-workers" label="online workers" value={isLoading ? "…" : formatInt(data?.total_workers ?? 0)} />
        <Stat testId="stat-blocks-24h" label="blocks · 24h" value={isLoading ? "…" : formatInt(data?.blocks_24h ?? 0)} accent="#00FF66" />
        <Stat testId="stat-coins-online" label="coins online" value={isLoading ? "…" : `${online.length}/${coins.length || 4}`} />
      </section>

      <section className="mt-10">
        <div className="mb-4 flex items-end justify-between">
          <h2 className="font-heading text-2xl font-semibold tracking-tight">Pools</h2>
          <span className="font-mono text-[11px] text-muted-foreground">auto-refresh 30s</span>
        </div>
        {isError && (
          <div data-testid="pool-stats-error" className="rounded-sm border border-dashed border-line p-6 font-mono text-xs text-muted-foreground">
            TELEMETRY_OFFLINE — pool stats unavailable right now.
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {coins.map((c, i) => <CoinCard key={c.symbol} c={c} i={i} />)}
        </div>
      </section>

      {online.length > 0 && (
        <section className="mt-12 grid gap-6 lg:grid-cols-[1fr_1.4fr]">
          <div>
            <h2 className="font-heading text-2xl font-semibold tracking-tight">Connect in 30 seconds</h2>
            <ol className="mt-4 space-y-3 font-mono text-xs text-muted-foreground">
              <li><span className="text-neon">01</span> · pick a coin and your miner software</li>
              <li><span className="text-neon">02</span> · paste your payout wallet + name your rig</li>
              <li><span className="text-neon">03</span> · copy the command, start hashing</li>
              <li><span className="text-neon">04</span> · track it here by wallet — payouts are automatic above the threshold</li>
            </ol>
          </div>
          <Panel title="stratum quick-connect" testId="quick-connect-panel">
            <Tabs defaultValue={online[0].symbol}>
              <TabsList variant="line" className="mb-4">
                {online.map((c) => (
                  <TabsTrigger key={c.symbol} value={c.symbol} data-testid={`quick-connect-tab-${c.symbol.toLowerCase()}`} className="font-mono text-xs">
                    {c.symbol}
                  </TabsTrigger>
                ))}
              </TabsList>
              {online.map((c) => (
                <TabsContent key={c.symbol} value={c.symbol}>
                  <StratumConnect coin={c} />
                </TabsContent>
              ))}
            </Tabs>
          </Panel>
        </section>
      )}
    </Layout>
  );
}
