import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { apiGet } from "@/lib/api";
import type { SampleWallet } from "@/lib/types";
import { shortHash } from "@/lib/format";
import CoinBadge from "@/components/CoinBadge";

export default function WalletSearchBar({ showSamples = true }: { showSamples?: boolean }) {
  const [wallet, setWallet] = useState("");
  const navigate = useNavigate();
  const samples = useQuery({ queryKey: ["samples"], queryFn: () => apiGet<SampleWallet[]>("/miners/samples") });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const w = wallet.trim();
    if (!w) {
      toast.error("Paste a wallet address first");
      return;
    }
    navigate(`/miner/${encodeURIComponent(w)}`);
  };

  return (
    <div className="space-y-3">
      <form onSubmit={submit} className="group flex items-stretch rounded-sm border border-line bg-term transition-colors duration-150 focus-within:border-neon/70">
        <span className="hidden items-center pl-3 font-mono text-sm text-neon sm:flex">$ lookup&nbsp;</span>
        <input
          data-testid="wallet-search-input"
          value={wallet}
          onChange={(e) => setWallet(e.target.value)}
          placeholder="paste your BTC / LTC / DOGE / ZANO wallet…"
          className="min-w-0 flex-1 bg-transparent px-3 py-3 font-mono text-sm text-foreground outline-none placeholder:text-muted-foreground/70"
          aria-label="Wallet address"
        />
        <Button type="submit" data-testid="wallet-search-button" className="m-1.5 h-auto rounded-sm px-4 font-mono text-xs uppercase tracking-wider">
          <Search className="size-4" /> Track
        </Button>
      </form>
      {showSamples && samples.data && samples.data.length > 0 && !samples.isError && (
        <div className="flex flex-wrap items-center gap-2" data-testid="sample-wallets">
          <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">try a demo miner:</span>
          {samples.data.map((s) => (
            <button
              key={s.wallet}
              type="button"
              data-testid={`sample-wallet-${s.coin.toLowerCase()}`}
              onClick={() => navigate(`/miner/${encodeURIComponent(s.wallet)}`)}
              className="flex items-center gap-2 rounded-sm border border-line bg-panel px-2 py-1 font-mono text-[11px] text-muted-foreground transition-colors duration-150 hover:border-neon/50 hover:text-foreground"
            >
              <CoinBadge symbol={s.coin} className="px-1.5 py-0 text-[10px]" />
              {shortHash(s.wallet, 6)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
