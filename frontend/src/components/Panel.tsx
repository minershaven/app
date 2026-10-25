import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function Panel({ title, right, children, className, testId }: {
  title?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
  testId?: string;
}) {
  return (
    <section data-testid={testId} className={cn("rounded-sm border border-line bg-panel/90 backdrop-blur-sm", className)}>
      {title && (
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{title}</h2>
          {right}
        </div>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Stat({ label, value, sub, accent, testId }: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  accent?: string;
  testId: string;
}) {
  return (
    <div className="rounded-sm border border-line bg-panel/90 px-4 py-3 transition-colors duration-150 hover:border-neon/30">
      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{label}</div>
      <div data-testid={testId} className="mt-1 font-mono text-xl font-semibold tabular-nums tracking-tight" style={accent ? { color: accent } : undefined}>
        {value}
      </div>
      {sub && <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">{sub}</div>}
    </div>
  );
}
