import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { CoinSummary } from "@/lib/types";
import { coinStyle } from "@/lib/format";

type Software = { id: string; label: string; cmd: (url: string, hostPort: string, user: string) => string };

const SOFTWARE: Record<string, Software[]> = {
  BTC: [
    { id: "cgminer", label: "CGMiner", cmd: (u, _h, user) => `cgminer -o ${u} -u ${user} -p x` },
    { id: "bfgminer", label: "BFGMiner", cmd: (u, _h, user) => `bfgminer -o ${u} -u ${user} -p x` },
    { id: "antminer", label: "Antminer UI", cmd: (u, _h, user) => `Pool URL: ${u}\nWorker:   ${user}\nPassword: x` },
  ],
  LTC: [
    { id: "cgminer", label: "CGMiner (scrypt)", cmd: (u, _h, user) => `cgminer --scrypt -o ${u} -u ${user} -p x` },
    { id: "bmminer", label: "Antminer L7 UI", cmd: (u, _h, user) => `Pool URL: ${u}\nWorker:   ${user}\nPassword: x` },
  ],
  DOGE: [
    { id: "cgminer", label: "CGMiner (scrypt)", cmd: (u, _h, user) => `cgminer --scrypt -o ${u} -u ${user} -p x` },
    { id: "bmminer", label: "Antminer L7 UI", cmd: (u, _h, user) => `Pool URL: ${u}\nWorker:   ${user}\nPassword: x` },
  ],
  ZANO: [
    { id: "lolminer", label: "lolMiner", cmd: (_u, h, user) => `lolMiner --algo ZANO --pool ${h} --user ${user}` },
    { id: "bzminer", label: "BzMiner", cmd: (u, _h, user) => `bzminer -a zano -p ${u} -w ${user}` },
    { id: "srbminer", label: "SRBMiner-MULTI", cmd: (_u, h, user) => `SRBMiner-MULTI --algorithm progpow_zano --pool ${h} --wallet ${user}` },
  ],
};

export default function StratumConnect({ coin }: { coin: CoinSummary }) {
  const list = SOFTWARE[coin.symbol] ?? SOFTWARE.BTC;
  const [sw, setSw] = useState(list[0].id);
  const [wallet, setWallet] = useState("");
  const [worker, setWorker] = useState("rig01");
  const [copied, setCopied] = useState<string | null>(null);
  const s = coinStyle(coin.symbol);

  const hostPort = `${coin.stratum_host}:${coin.stratum_port}`;
  const url = `stratum+tcp://${hostPort}`;
  const user = `${wallet.trim() || "YOUR_WALLET"}.${worker.trim() || "rig01"}`;
  const software = list.find((x) => x.id === sw) ?? list[0];
  const cmd = software.cmd(url, hostPort, user);

  const copy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* clipboard unavailable — still confirm so the user can select manually */
    }
    setCopied(key);
    toast.success(key === "url" ? "Stratum URL copied" : "Miner command copied");
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <div data-testid={`stratum-connect-${coin.symbol.toLowerCase()}`} className="space-y-4">
      <div className="flex items-center justify-between gap-3 rounded-sm border border-line bg-term px-3 py-2.5 scanlines">
        <div className="min-w-0">
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">stratum://</div>
          <div data-testid="stratum-url" className="truncate font-mono text-sm" style={{ color: s.color }}>
            {url}
          </div>
        </div>
        <button
          type="button"
          aria-label="Copy stratum URL"
          data-testid="stratum-copy-url-button"
          onClick={() => copy(url, "url")}
          className="grid size-8 shrink-0 place-items-center rounded-sm border border-line text-muted-foreground transition-colors duration-150 hover:border-neon/60 hover:text-neon"
        >
          {copied === "url" ? <Check className="size-4" /> : <Copy className="size-4" />}
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <input
          data-testid="stratum-wallet-input"
          value={wallet}
          onChange={(e) => setWallet(e.target.value)}
          placeholder={`${coin.symbol} wallet`}
          className="rounded-sm border border-line bg-term px-3 py-2 font-mono text-xs outline-none transition-colors duration-150 focus:border-neon/60"
        />
        <input
          data-testid="stratum-worker-input"
          value={worker}
          onChange={(e) => setWorker(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ""))}
          placeholder="worker name"
          className="rounded-sm border border-line bg-term px-3 py-2 font-mono text-xs outline-none transition-colors duration-150 focus:border-neon/60"
        />
        <Select value={sw} onValueChange={(v: string) => setSw(v)}>
          <SelectTrigger data-testid="stratum-software-select" className="min-w-40 rounded-sm font-mono text-xs">
            <SelectValue>{(v) => list.find((x) => x.id === v)?.label ?? ""}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {list.map((x) => (
              <SelectItem key={x.id} value={x.id} data-testid={`stratum-software-${x.id}`} className="font-mono text-xs">
                {x.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="relative rounded-sm border border-line bg-term p-4 scanlines">
        <pre data-testid="stratum-command" className="overflow-x-auto whitespace-pre-wrap break-all pr-10 font-mono text-xs leading-relaxed text-neon">
          <span className="text-muted-foreground">$ </span>
          {cmd}
          <span className="ml-0.5 inline-block h-3.5 w-1.5 translate-y-0.5 animate-blink bg-neon" />
        </pre>
        <button
          type="button"
          aria-label="Copy miner command"
          data-testid="stratum-copy-button"
          onClick={() => copy(cmd, "cmd")}
          className="absolute right-3 top-3 grid size-8 place-items-center rounded-sm border border-line text-muted-foreground transition-colors duration-150 hover:border-neon/60 hover:text-neon"
        >
          {copied === "cmd" ? <Check className="size-4" /> : <Copy className="size-4" />}
        </button>
      </div>
      <p className="font-mono text-[11px] leading-relaxed text-muted-foreground">
        Username format <span className="text-foreground">WALLET.WORKER</span> · password <span className="text-foreground">x</span> · algo{" "}
        <span style={{ color: s.color }}>{coin.algo}</span> · vardiff enabled
      </p>
    </div>
  );
}
