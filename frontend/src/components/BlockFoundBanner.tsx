import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { Box, X } from "lucide-react";
import { toast } from "sonner";
import CoinBadge from "@/components/CoinBadge";
import { apiGet } from "@/lib/api";
import type { Block, RecentBlocks } from "@/lib/types";
import { coinStyle, formatCoin, formatInt, shortHash } from "@/lib/format";

const FRESH_MINUTES = 30;
const DISMISS_KEY = "mh-dismissed-block";

function minutesOld(b: Block, serverTime: string): number {
  return (new Date(serverTime).getTime() - new Date(b.found_at).getTime()) / 60000;
}

export default function BlockFoundBanner() {
  const { data, isError } = useQuery({
    queryKey: ["blocks-recent"],
    queryFn: () => apiGet<RecentBlocks>("/blocks/recent"),
    refetchInterval: 15_000,
  });
  const [dismissed, setDismissed] = useState<string | null>(() => localStorage.getItem(DISMISS_KEY));
  const lastSeen = useRef<string | null>(null);

  const newest = !isError ? data?.blocks[0] : undefined;

  // Toast when a block lands while the page is open (not on first load)
  useEffect(() => {
    if (!newest) return;
    if (lastSeen.current && lastSeen.current !== newest.id) {
      toast.success(`${newest.coin} block #${formatInt(newest.height)} found!`, {
        description: `${formatCoin(newest.reward, newest.coin)} reward`,
      });
    }
    lastSeen.current = newest.id;
  }, [newest]);

  const show = newest && data && newest.id !== dismissed && minutesOld(newest, data.server_time) <= FRESH_MINUTES;
  const mins = newest && data ? Math.max(0, Math.floor(minutesOld(newest, data.server_time))) : 0;
  const s = coinStyle(newest?.coin ?? "");

  const dismiss = () => {
    if (!newest) return;
    localStorage.setItem(DISMISS_KEY, newest.id);
    setDismissed(newest.id);
  };

  return (
    <AnimatePresence>
      {show && newest && (
        <motion.div
          key={newest.id}
          initial={{ opacity: 0, y: -12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          data-testid="block-found-banner"
          className="relative mb-8 overflow-hidden rounded-sm border bg-term/95 scanlines animate-block-glow"
          style={{ borderColor: `${s.color}66`, ["--glow" as string]: `${s.color}55` }}
        >
          <div className="absolute inset-y-0 left-0 w-1" style={{ backgroundColor: s.color }} />
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3 py-3 pl-5 pr-12">
            <div className="flex items-center gap-3">
              <span className="relative grid size-9 place-items-center rounded-sm border" style={{ borderColor: `${s.color}66`, color: s.color }}>
                <Box className="size-4" />
                <span className="absolute -right-1 -top-1 size-2.5 animate-ping rounded-full" style={{ backgroundColor: s.color }} />
              </span>
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.25em]" style={{ color: s.color }}>
                  block found · {mins === 0 ? "just now" : `${mins} min ago`}
                </div>
                <div className="font-heading text-lg font-semibold leading-tight">
                  <span data-testid="block-found-coin">{newest.coin}</span> pool hit block{" "}
                  <span data-testid="block-found-height" className="font-mono">#{formatInt(newest.height)}</span>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 font-mono text-xs">
              <span><span className="text-muted-foreground">reward </span><span data-testid="block-found-reward" className="text-neon">{formatCoin(newest.reward, newest.coin)}</span></span>
              {newest.effort_pct != null && (
                <span><span className="text-muted-foreground">effort </span><span className={newest.effort_pct > 100 ? "text-amber-400" : "text-neon"}>{newest.effort_pct.toFixed(1)}%</span></span>
              )}
              {newest.found_by && (
                <span><span className="text-muted-foreground">finder </span>
                  <Link to={`/miner/${encodeURIComponent(newest.found_by)}`} data-testid="block-found-finder-link" className="transition-colors duration-150 hover:text-neon">
                    {shortHash(newest.found_by, 6)}
                  </Link>
                </span>
              )}
              <CoinBadge symbol={newest.coin} className="hidden sm:inline-flex" />
            </div>
            <Link
              to={`/coin/${newest.coin}`}
              data-testid="block-found-view-link"
              className="ml-auto rounded-sm border border-line px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-muted-foreground transition-colors duration-150 hover:border-neon/60 hover:text-neon"
            >
              view blocks →
            </Link>
          </div>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss block banner"
            data-testid="block-found-dismiss-button"
            className="absolute right-3 top-3 grid size-7 place-items-center rounded-sm text-muted-foreground transition-colors duration-150 hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
