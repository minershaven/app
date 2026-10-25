import { formatDistanceToNowStrict } from "date-fns";

const UNITS = ["H/s", "KH/s", "MH/s", "GH/s", "TH/s", "PH/s", "EH/s", "ZH/s"];

export function formatHashrate(h: number): string {
  if (!h || h <= 0) return "0 H/s";
  let i = 0;
  let v = h;
  while (v >= 1000 && i < UNITS.length - 1) {
    v /= 1000;
    i++;
  }
  return `${v.toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 })} ${UNITS[i]}`;
}

export function formatCoin(v: number, symbol: string): string {
  const digits = symbol === "DOGE" ? 2 : symbol === "BTC" ? 8 : 4;
  return `${v.toLocaleString("en-US", { maximumFractionDigits: digits, minimumFractionDigits: Math.min(digits, 2) })} ${symbol}`;
}

export function formatUsd(v: number): string {
  return v.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: v < 1 ? 4 : 2 });
}

export function formatInt(v: number): string {
  return v.toLocaleString("en-US");
}

export function ago(iso: string | null): string {
  if (!iso) return "—";
  return `${formatDistanceToNowStrict(new Date(iso))} ago`;
}

export function shortHash(h: string, n = 8): string {
  return h.length <= n * 2 + 1 ? h : `${h.slice(0, n)}…${h.slice(-n)}`;
}

export const COIN_STYLE: Record<string, { color: string; bg: string }> = {
  BTC: { color: "#F59E0B", bg: "#2D1D02" },
  LTC: { color: "#38BDF8", bg: "#122033" },
  DOGE: { color: "#FACC15", bg: "#2A2308" },
  ZANO: { color: "#C084FC", bg: "#1F112D" },
};

export function coinStyle(sym: string) {
  return COIN_STYLE[sym] ?? { color: "#00FF66", bg: "#05080E" };
}
