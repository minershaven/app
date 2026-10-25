import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LogOut, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import Layout from "@/components/Layout";
import CoinBadge from "@/components/CoinBadge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiGet, apiPost, apiPut, ApiError } from "@/lib/api";
import type { AdminStatus, CoinConfig, CoinUpdate } from "@/lib/types";

function errMsg(e: unknown): string {
  if (e instanceof ApiError) {
    const d = (e.body as { detail?: unknown } | null)?.detail;
    if (typeof d === "string") return d;
    if (Array.isArray(d)) return "Invalid value — check the fields";
  }
  return "Request failed";
}

function CoinEditor({ coin }: { coin: CoinConfig }) {
  const qc = useQueryClient();
  const sym = coin.symbol.toLowerCase();
  const [fee, setFee] = useState(String(coin.fee_pct));
  const [minPayout, setMinPayout] = useState(String(coin.min_payout));
  const [port, setPort] = useState(String(coin.stratum_port));
  const [rpc, setRpc] = useState(coin.rpc_url);
  const [enabled, setEnabled] = useState(coin.enabled);

  const save = useMutation({
    mutationFn: (body: CoinUpdate) => apiPut<CoinConfig>(`/admin/coins/${coin.symbol}`, body),
    onSuccess: (c) => {
      toast.success(`${c.symbol} settings saved`);
      qc.invalidateQueries({ queryKey: ["admin-coins"] });
      qc.invalidateQueries({ queryKey: ["pool-stats"] });
      qc.invalidateQueries({ queryKey: ["coin"] });
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate({
      fee_pct: Number(fee),
      min_payout: Number(minPayout),
      stratum_port: Number(port),
      rpc_url: rpc.trim(),
      enabled,
    });
  };

  const field = "font-mono text-xs bg-term rounded-sm";
  return (
    <form onSubmit={submit} data-testid={`admin-coin-${sym}`} className="rounded-sm border border-line bg-panel/90 p-5 transition-colors duration-150 hover:border-neon/30">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CoinBadge symbol={coin.symbol} />
          <span className="font-heading text-lg font-semibold">{coin.name}</span>
          <span className="font-mono text-[11px] text-muted-foreground">{coin.algo}</span>
        </div>
        <label className="flex cursor-pointer items-center gap-2 font-mono text-xs">
          <Checkbox data-testid={`admin-${sym}-enabled-checkbox`} checked={enabled} onCheckedChange={(v) => setEnabled(Boolean(v))} />
          <span className={enabled ? "text-neon" : "text-red-400"}>{enabled ? "ENABLED" : "DISABLED"}</span>
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">pool fee %</Label>
          <Input data-testid={`admin-${sym}-fee-input`} type="number" step="0.1" min="0" max="10" value={fee} onChange={(e) => setFee(e.target.value)} className={field} />
        </div>
        <div className="space-y-1.5">
          <Label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">min payout ({coin.symbol})</Label>
          <Input data-testid={`admin-${sym}-min-payout-input`} type="number" step="any" min="0" value={minPayout} onChange={(e) => setMinPayout(e.target.value)} className={field} />
        </div>
        <div className="space-y-1.5">
          <Label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">stratum port</Label>
          <Input data-testid={`admin-${sym}-port-input`} type="number" min="1024" max="65535" value={port} onChange={(e) => setPort(e.target.value)} className={field} />
        </div>
        <div className="space-y-1.5 sm:col-span-3">
          <Label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">node rpc endpoint</Label>
          <Input data-testid={`admin-${sym}-rpc-input`} value={rpc} onChange={(e) => setRpc(e.target.value)} className={field} />
        </div>
      </div>
      <div className="mt-4 flex justify-end">
        <Button type="submit" data-testid={`admin-${sym}-save-button`} disabled={save.isPending} className="rounded-sm font-mono text-xs uppercase tracking-wider">
          {save.isPending ? "saving…" : "save config"}
        </Button>
      </div>
    </form>
  );
}

function LoginGate() {
  const qc = useQueryClient();
  const [pw, setPw] = useState("");
  const login = useMutation({
    mutationFn: () => apiPost<AdminStatus>("/admin/login", { password: pw }),
    onSuccess: () => {
      toast.success("Access granted");
      qc.invalidateQueries({ queryKey: ["admin-me"] });
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  return (
    <div className="mx-auto mt-10 max-w-md animate-rise rounded-sm border border-line bg-term p-6 scanlines">
      <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.25em] text-amber-400">
        <ShieldAlert className="size-4" /> restricted terminal
      </div>
      <h1 className="mt-3 font-heading text-3xl font-bold tracking-tight">Operator access</h1>
      <p className="mt-1 text-sm text-muted-foreground">Enter the admin passkey to manage coins, fees and stratum.</p>
      <form
        className="mt-6 space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (pw) login.mutate();
        }}
      >
        <Input data-testid="admin-password-input" type="password" placeholder="passkey" value={pw} onChange={(e) => setPw(e.target.value)} className="rounded-sm bg-panel font-mono" autoFocus />
        <Button type="submit" data-testid="admin-login-button" disabled={login.isPending || !pw} className="w-full rounded-sm font-mono text-xs uppercase tracking-wider">
          {login.isPending ? "authorizing…" : "authorize"}
        </Button>
      </form>
    </div>
  );
}

export default function Admin() {
  const qc = useQueryClient();
  const me = useQuery({ queryKey: ["admin-me"], queryFn: () => apiGet<AdminStatus>("/admin/me") });
  const authed = !me.isError && me.data?.authenticated === true;
  const coins = useQuery({
    queryKey: ["admin-coins"],
    queryFn: () => apiGet<CoinConfig[]>("/admin/coins"),
    enabled: authed,
  });
  const logout = useMutation({
    mutationFn: () => apiPost<AdminStatus>("/admin/logout"),
    onSuccess: () => {
      qc.removeQueries({ queryKey: ["admin-coins"] });
      qc.invalidateQueries({ queryKey: ["admin-me"] });
      toast("Logged out");
    },
  });

  return (
    <Layout>
      {!authed ? (
        me.isLoading ? <div className="font-mono text-xs text-muted-foreground">checking session…</div> : <LoginGate />
      ) : (
        <>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="font-mono text-[11px] uppercase tracking-[0.3em] text-neon">// operator console</div>
              <h1 className="mt-2 font-heading text-4xl font-bold tracking-tight">Pool configuration</h1>
              <p className="mt-1 text-sm text-muted-foreground">Changes apply instantly to the public dashboard.</p>
            </div>
            <Button variant="outline" data-testid="admin-logout-button" onClick={() => logout.mutate()} className="rounded-sm font-mono text-xs uppercase">
              <LogOut className="size-4" /> logout
            </Button>
          </div>
          <div className="mt-8 grid gap-5 lg:grid-cols-2">
            {coins.data?.map((c) => <CoinEditor key={`${c.symbol}-${c.fee_pct}-${c.min_payout}-${c.stratum_port}-${c.enabled}-${c.rpc_url}`} coin={c} />)}
          </div>
        </>
      )}
    </Layout>
  );
}
