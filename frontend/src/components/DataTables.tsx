import { Link } from "react-router-dom";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Block, Payout, Worker } from "@/lib/types";
import { ago, formatCoin, formatHashrate, formatInt, shortHash } from "@/lib/format";
import { cn } from "@/lib/utils";

const headCls = "font-mono text-[10px] uppercase tracking-widest text-muted-foreground";
const empty = (cols: number, msg: string, id: string) => (
  <TableRow>
    <TableCell colSpan={cols} data-testid={id} className="py-10 text-center font-mono text-xs text-muted-foreground">
      {msg}
    </TableCell>
  </TableRow>
);

const STATUS_CLS: Record<Block["status"], string> = {
  confirmed: "text-neon border-neon/40 bg-neon/5",
  pending: "text-amber-400 border-amber-400/40 bg-amber-400/5",
  orphaned: "text-red-400 border-red-400/40 bg-red-400/5",
};

export function BlocksTable({ blocks }: { blocks: Block[] }) {
  return (
    <Table data-testid="blocks-table">
      <TableHeader>
        <TableRow className="border-line hover:bg-transparent">
          <TableHead className={headCls}>Height</TableHead>
          <TableHead className={headCls}>Hash</TableHead>
          <TableHead className={headCls}>Reward</TableHead>
          <TableHead className={headCls}>Effort</TableHead>
          <TableHead className={headCls}>Status</TableHead>
          <TableHead className={headCls}>Found</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {blocks.length === 0 && empty(6, "NO_BLOCKS_YET", "blocks-empty")}
        {blocks.map((b) => (
          <TableRow key={b.id} data-testid={`block-row-${b.height}`} className="border-line font-mono text-xs transition-colors duration-150 hover:bg-panel-2">
            <TableCell className="tabular-nums text-foreground">{formatInt(b.height)}</TableCell>
            <TableCell className="text-muted-foreground">
              {b.info_link ? (
                <a href={b.info_link} target="_blank" rel="noreferrer" className="transition-colors duration-150 hover:text-neon">{shortHash(b.hash, 10)}</a>
              ) : shortHash(b.hash, 10)}
            </TableCell>
            <TableCell className="tabular-nums">{formatCoin(b.reward, b.coin)}</TableCell>
            <TableCell className={cn("tabular-nums", (b.effort_pct ?? 0) > 100 ? "text-amber-400" : "text-neon")}>
              {b.effort_pct != null ? `${b.effort_pct.toFixed(1)}%` : "—"}
            </TableCell>
            <TableCell>
              <span className={cn("rounded-sm border px-1.5 py-0.5 text-[10px] uppercase tracking-wider", STATUS_CLS[b.status])}>
                {b.status}
                {b.status === "pending" && ` ${Math.round(b.confirmation_progress * 100)}%`}
              </span>
            </TableCell>
            <TableCell className="text-muted-foreground">{ago(b.found_at)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function PayoutsTable({ payouts, showWallet = true }: { payouts: Payout[]; showWallet?: boolean }) {
  return (
    <Table data-testid="payouts-table">
      <TableHeader>
        <TableRow className="border-line hover:bg-transparent">
          {showWallet && <TableHead className={headCls}>Wallet</TableHead>}
          <TableHead className={headCls}>Amount</TableHead>
          <TableHead className={headCls}>Tx</TableHead>
          <TableHead className={headCls}>Paid</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {payouts.length === 0 && empty(showWallet ? 4 : 3, "NO_PAYOUTS_YET", "payouts-empty")}
        {payouts.map((p) => (
          <TableRow key={p.id} data-testid={`payout-row-${p.id}`} className="border-line font-mono text-xs transition-colors duration-150 hover:bg-panel-2">
            {showWallet && (
              <TableCell>
                <Link to={`/miner/${encodeURIComponent(p.wallet)}`} className="text-muted-foreground transition-colors duration-150 hover:text-neon">
                  {shortHash(p.wallet, 7)}
                </Link>
              </TableCell>
            )}
            <TableCell className="tabular-nums text-neon">{formatCoin(p.amount, p.coin)}</TableCell>
            <TableCell className="text-muted-foreground">
              {p.tx_link ? (
                <a href={p.tx_link} target="_blank" rel="noreferrer" className="transition-colors duration-150 hover:text-neon">{shortHash(p.tx_hash, 8)}</a>
              ) : shortHash(p.tx_hash, 8)}
            </TableCell>
            <TableCell className="text-muted-foreground">{ago(p.paid_at)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function WorkerTable({ workers }: { workers: Worker[] }) {
  return (
    <Table data-testid="workers-table">
      <TableHeader>
        <TableRow className="border-line hover:bg-transparent">
          <TableHead className={headCls}>Worker</TableHead>
          <TableHead className={headCls}>Hashrate</TableHead>
          <TableHead className={headCls}>Shares/s</TableHead>
          <TableHead className={headCls}>Last share</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {workers.length === 0 && empty(4, "NO_WORKERS", "workers-empty")}
        {workers.map((w) => (
          <TableRow key={w.name} data-testid={`worker-row-${w.name}`} className="border-line font-mono text-xs transition-colors duration-150 hover:bg-panel-2">
            <TableCell>
              <span className="flex items-center gap-2">
                <span className={cn("size-1.5 rounded-full", w.online ? "animate-pulse bg-neon" : "bg-red-500")} />
                <span className={w.online ? "text-foreground" : "text-muted-foreground"}>{w.name}</span>
                {!w.online && <span className="text-[10px] uppercase text-red-400">offline</span>}
              </span>
            </TableCell>
            <TableCell className="tabular-nums">{formatHashrate(w.hashrate)}</TableCell>
            <TableCell className="tabular-nums text-neon">{w.shares_per_second.toFixed(3)}</TableCell>
            <TableCell className="text-muted-foreground">{ago(w.last_share_at)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
