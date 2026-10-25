import { coinStyle } from "@/lib/format";
import { cn } from "@/lib/utils";

export default function CoinBadge({ symbol, className }: { symbol: string; className?: string }) {
  const s = coinStyle(symbol);
  return (
    <span
      data-testid={`coin-badge-${symbol.toLowerCase()}`}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-sm border px-2 py-0.5 font-mono text-xs font-semibold tracking-wider",
        className,
      )}
      style={{ color: s.color, backgroundColor: s.bg, borderColor: `${s.color}40` }}
    >
      <span className="size-1.5 rounded-full" style={{ backgroundColor: s.color }} />
      {symbol}
    </span>
  );
}
