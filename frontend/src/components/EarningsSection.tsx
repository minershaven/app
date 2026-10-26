import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Panel } from "@/components/Panel";
import { apiGet } from "@/lib/api";
import type { MinerEarnings } from "@/lib/types";
import { ago, coinStyle, formatCoin } from "@/lib/format";
import { cn } from "@/lib/utils";

// UTC date string "2026-10-25" → local Date at midnight for display only
const day = (d: string) => new Date(`${d}T00:00:00`);

export default function EarningsSection({ wallet, enabled }: { wallet: string; enabled: boolean }) {
  const { data, isError } = useQuery({
    queryKey: ["miner", wallet, "earnings"],
    queryFn: () => apiGet<MinerEarnings>(`/miners/${encodeURIComponent(wallet)}/earnings`),
    enabled,
    refetchInterval: 60_000,
  });
  const e = !isError ? data : undefined;
  const s = coinStyle(e?.coin ?? "");
  const days = e?.daily.length ?? 0;
  const avg = e && days ? e.total_30d / days : 0;
  const best = e?.daily.reduce((m, d) => Math.max(m, d.amount), 0) ?? 0;

  return (
    <section className="mt-6 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
      <Panel
        title={`daily earnings · ${days || 30} days`}
        testId="miner-earnings-panel"
        right={e && <span data-testid="miner-earnings-total" className="font-mono text-[11px] text-neon">Σ {formatCoin(e.total_30d, e.coin)}</span>}
      >
        <div className="mb-4 grid grid-cols-2 gap-3 font-mono text-[11px]">
          <div className="rounded-sm border border-line bg-term px-3 py-2">
            <div className="text-muted-foreground">avg / day</div>
            <div data-testid="miner-earnings-avg" className="mt-0.5 text-sm tabular-nums" style={{ color: s.color }}>{e ? formatCoin(avg, e.coin) : "—"}</div>
          </div>
          <div className="rounded-sm border border-line bg-term px-3 py-2">
            <div className="text-muted-foreground">best day</div>
            <div data-testid="miner-earnings-best" className="mt-0.5 text-sm tabular-nums">{e ? formatCoin(best, e.coin) : "—"}</div>
          </div>
        </div>
        {e && e.daily.length > 0 ? (
          <div data-testid="miner-earnings-chart" style={{ height: 220 }} role="img" aria-label="Daily earnings chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={e.daily} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="#1E293B" strokeDasharray="2 4" vertical={false} />
                <XAxis dataKey="date" tickFormatter={(d: string) => format(day(d), "MMM d")} stroke="#475569" minTickGap={24}
                  tick={{ fontSize: 10, fontFamily: "JetBrains Mono Variable" }} />
                <YAxis stroke="#475569" width={72} tickFormatter={(v: number) => v.toLocaleString("en-US", { maximumSignificantDigits: 3 })}
                  tick={{ fontSize: 10, fontFamily: "JetBrains Mono Variable" }} />
                <Tooltip
                  cursor={{ fill: "rgba(0,255,102,0.06)" }}
                  contentStyle={{ background: "#05080E", border: `1px solid ${s.color}55`, borderRadius: 2, fontFamily: "JetBrains Mono Variable", fontSize: 12 }}
                  labelStyle={{ color: "#94A3B8" }}
                  itemStyle={{ color: s.color }}
                  labelFormatter={(label: string) => format(day(label), "EEE, MMM d")}
                  formatter={(value: number) => [formatCoin(value, e.coin), "earned"]}
                />
                <Bar dataKey="amount" fill={s.color} fillOpacity={0.85} radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div data-testid="miner-earnings-empty" style={{ height: 220 }} className="grid place-items-center rounded-sm border border-dashed border-line font-mono text-xs text-muted-foreground">
            NO_EARNINGS_YET — rewards appear after your first confirmed block
          </div>
        )}
      </Panel>

      <Panel title="balance history" testId="miner-balance-history-panel">
        <ul className="max-h-[330px] space-y-1 overflow-y-auto pr-1" data-testid="miner-balance-history">
          {(!e || e.balance_changes.length === 0) && (
            <li data-testid="miner-balance-history-empty" className="py-10 text-center font-mono text-xs text-muted-foreground">NO_BALANCE_CHANGES</li>
          )}
          {e?.balance_changes.map((c) => (
            <li key={c.id} data-testid={`balance-change-${c.id}`} className="flex items-center justify-between gap-3 rounded-sm px-2 py-2 font-mono text-xs transition-colors duration-150 hover:bg-panel-2">
              <div className="min-w-0">
                <div className="truncate text-foreground">{c.usage || (c.amount >= 0 ? "Credit" : "Debit")}</div>
                <div className="text-[10px] text-muted-foreground">{ago(c.created)}</div>
              </div>
              <span className={cn("shrink-0 tabular-nums", c.amount >= 0 ? "text-neon" : "text-amber-400")}>
                {c.amount >= 0 ? "+" : "−"}{formatCoin(Math.abs(c.amount), e.coin)}
              </span>
            </li>
          ))}
        </ul>
      </Panel>
    </section>
  );
}
