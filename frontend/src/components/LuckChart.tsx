import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Panel } from "@/components/Panel";
import type { Block } from "@/lib/types";
import { formatInt } from "@/lib/format";

const LUCKY = "#00FF66";
const UNLUCKY = "#F59E0B";
const ORPHAN = "#EF4444";

function barColor(b: Block): string {
  if (b.status === "orphaned") return ORPHAN;
  return (b.effort_pct ?? 0) <= 100 ? LUCKY : UNLUCKY;
}

export default function LuckChart({ blocks, symbol }: { blocks: Block[]; symbol: string }) {
  // oldest → newest, only blocks that report an effort
  const data = blocks.filter((b) => b.effort_pct != null).slice().reverse();
  const efforts = data.map((b) => b.effort_pct as number);
  const n = efforts.length;
  const avg = n ? efforts.reduce((a, v) => a + v, 0) / n : 0;
  const lucky = efforts.filter((e) => e <= 100).length;
  const best = n ? Math.min(...efforts) : 0;
  const worst = n ? Math.max(...efforts) : 0;
  const top = Math.max(150, Math.ceil(worst / 50) * 50);
  const ticks = Array.from({ length: top / 50 + 1 }, (_, i) => i * 50);
  const luckLabel = !n ? "—" : avg <= 100 ? "running lucky" : "running unlucky";

  return (
    <Panel
      className="mt-6"
      title={`block luck · last ${n || 0} blocks`}
      testId="coin-luck-panel"
      right={
        n > 0 && (
          <span data-testid="luck-verdict" className="font-mono text-[11px]" style={{ color: avg <= 100 ? LUCKY : UNLUCKY }}>
            ● {luckLabel}
          </span>
        )
      }
    >
      <div className="mb-4 grid grid-cols-2 gap-3 font-mono text-[11px] sm:grid-cols-4">
        <div className="rounded-sm border border-line bg-term px-3 py-2">
          <div className="text-muted-foreground">avg effort</div>
          <div data-testid="luck-avg-effort" className="mt-0.5 text-sm tabular-nums" style={{ color: avg <= 100 ? LUCKY : UNLUCKY }}>
            {n ? `${avg.toFixed(1)}%` : "—"}
          </div>
        </div>
        <div className="rounded-sm border border-line bg-term px-3 py-2">
          <div className="text-muted-foreground">lucky blocks</div>
          <div data-testid="luck-lucky-count" className="mt-0.5 text-sm tabular-nums">{n ? `${lucky}/${n} · ${Math.round((lucky / n) * 100)}%` : "—"}</div>
        </div>
        <div className="rounded-sm border border-line bg-term px-3 py-2">
          <div className="text-muted-foreground">luckiest</div>
          <div data-testid="luck-best" className="mt-0.5 text-sm tabular-nums text-neon">{n ? `${best.toFixed(1)}%` : "—"}</div>
        </div>
        <div className="rounded-sm border border-line bg-term px-3 py-2">
          <div className="text-muted-foreground">unluckiest</div>
          <div data-testid="luck-worst" className="mt-0.5 text-sm tabular-nums text-amber-400">{n ? `${worst.toFixed(1)}%` : "—"}</div>
        </div>
      </div>

      {n > 0 ? (
        <>
          <div data-testid="luck-chart" style={{ height: 240 }} role="img" aria-label={`${symbol} block effort chart`}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="#1E293B" strokeDasharray="2 4" vertical={false} />
                <XAxis dataKey="height" tickFormatter={(h: number) => `#${formatInt(h)}`} stroke="#475569" minTickGap={48}
                  tick={{ fontSize: 10, fontFamily: "JetBrains Mono Variable" }} />
                <YAxis stroke="#475569" width={48} domain={[0, top]} ticks={ticks} tickFormatter={(v: number) => `${v}%`}
                  tick={{ fontSize: 10, fontFamily: "JetBrains Mono Variable" }} />
                <Tooltip
                  cursor={{ fill: "rgba(148,163,184,0.06)" }}
                  contentStyle={{ background: "#05080E", border: "1px solid #1E293B", borderRadius: 2, fontFamily: "JetBrains Mono Variable", fontSize: 12 }}
                  labelStyle={{ color: "#94A3B8" }}
                  itemStyle={{ color: "#F1F5F9" }}
                  labelFormatter={(label: string) => `block #${formatInt(Number(label))}`}
                  formatter={(value: number) => [`${value.toFixed(1)}%`, value <= 100 ? "effort · lucky" : "effort · unlucky"]}
                />
                <ReferenceLine y={100} stroke="#94A3B8" strokeDasharray="4 4" label={{ value: "100%", position: "insideTopRight", fill: "#94A3B8", fontSize: 10 }} />
                <ReferenceLine y={avg} stroke={avg <= 100 ? LUCKY : UNLUCKY} strokeOpacity={0.6} strokeDasharray="2 3"
                  label={{ value: `avg ${avg.toFixed(0)}%`, position: "insideTopLeft", fill: avg <= 100 ? LUCKY : UNLUCKY, fontSize: 10 }} />
                <Bar dataKey="effort_pct" radius={[2, 2, 0, 0]}>
                  {data.map((b) => <Cell key={b.id} fill={barColor(b)} fillOpacity={0.85} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 flex flex-wrap gap-4 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="size-2 rounded-[1px]" style={{ background: LUCKY }} /> under 100% · lucky</span>
            <span className="flex items-center gap-1.5"><span className="size-2 rounded-[1px]" style={{ background: UNLUCKY }} /> over 100% · unlucky</span>
            <span className="flex items-center gap-1.5"><span className="size-2 rounded-[1px]" style={{ background: ORPHAN }} /> orphaned</span>
            <span className="normal-case tracking-normal">Effort = shares submitted ÷ shares expected for the block. Lower is luckier.</span>
          </div>
        </>
      ) : (
        <div data-testid="luck-chart-empty" style={{ height: 240 }} className="grid place-items-center rounded-sm border border-dashed border-line font-mono text-xs text-muted-foreground">
          NO_BLOCKS_YET — luck appears after the first block
        </div>
      )}
    </Panel>
  );
}
