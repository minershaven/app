import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { format } from "date-fns";
import type { HashratePoint } from "@/lib/types";
import { formatHashrate } from "@/lib/format";

export default function HashrateChart({
  data,
  color = "#00FF66",
  height = 260,
  testId = "hashrate-chart",
}: {
  data: HashratePoint[];
  color?: string;
  height?: number;
  testId?: string;
}) {
  const gid = `g-${testId}`;
  if (!data.length) {
    return (
      <div data-testid={`${testId}-empty`} style={{ height }} className="grid place-items-center rounded-sm border border-dashed border-line font-mono text-xs text-muted-foreground">
        NO_TELEMETRY — awaiting shares
      </div>
    );
  }
  return (
    <div data-testid={testId} style={{ height }} aria-label="Hashrate chart" role="img">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#1E293B" strokeDasharray="2 4" vertical={false} />
          <XAxis
            dataKey="t"
            tickFormatter={(t: string) => format(new Date(t), "HH:mm")}
            stroke="#475569"
            tick={{ fontSize: 10, fontFamily: "JetBrains Mono Variable" }}
            minTickGap={40}
          />
          <YAxis
            tickFormatter={(v: number) => formatHashrate(v)}
            stroke="#475569"
            width={92}
            tick={{ fontSize: 10, fontFamily: "JetBrains Mono Variable" }}
          />
          <Tooltip
            contentStyle={{ background: "#05080E", border: `1px solid ${color}55`, borderRadius: 2, fontFamily: "JetBrains Mono Variable", fontSize: 12 }}
            labelStyle={{ color: "#94A3B8" }}
            itemStyle={{ color }}
            labelFormatter={(label: string) => format(new Date(label), "MMM d, h:mm a")}
            formatter={(value: number) => [formatHashrate(value), "hashrate"]}
          />
          <Area type="monotone" dataKey="hashrate" stroke={color} strokeWidth={2} fill={`url(#${gid})`} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
