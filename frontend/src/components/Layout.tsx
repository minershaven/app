import { Link, NavLink } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

const NAV = [
  { to: "/", label: "Overview", id: "overview" },
  { to: "/coin/BTC", label: "BTC", id: "btc" },
  { to: "/coin/LTC", label: "LTC", id: "ltc" },
  { to: "/coin/DOGE", label: "DOGE", id: "doge" },
  { to: "/coin/ZANO", label: "ZANO", id: "zano" },
  { to: "/admin", label: "Admin", id: "admin" },
];

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen bg-background">
      <div className="pointer-events-none fixed inset-0 bg-grid opacity-40 [mask-image:radial-gradient(ellipse_at_top_left,black,transparent_70%)]" />
      <header className="sticky top-0 z-40 border-b border-line bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center gap-6 px-4 py-3 sm:px-6">
          <Link to="/" data-testid="header-logo-link" className="group flex items-center gap-2 font-heading text-lg font-bold tracking-tight">
            <span className="grid size-7 place-items-center rounded-sm border border-neon/50 bg-term font-mono text-sm text-neon transition-shadow duration-200 group-hover:shadow-[0_0_16px_rgba(0,255,102,0.45)]">
              ⛏
            </span>
            <span>
              MINERS<span className="text-neon">//</span>HAVEN
            </span>
          </Link>
          <nav className="ml-auto flex items-center gap-1 overflow-x-auto font-mono text-xs uppercase">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.to === "/"}
                data-testid={`nav-${n.id}-link`}
                className={({ isActive }) =>
                  cn(
                    "whitespace-nowrap rounded-sm px-2.5 py-1.5 tracking-wider text-muted-foreground transition-colors duration-150 hover:text-foreground",
                    isActive && "bg-panel-2 text-neon",
                  )
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main className="relative z-10 mx-auto max-w-7xl px-4 pb-24 pt-8 sm:px-6">{children}</main>
      <footer className="relative z-10 border-t border-line">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-6 font-mono text-xs text-muted-foreground sm:px-6">
          <span>© 2026 MinersHaven · PPLNS · BTC / LTC / DOGE / ZANO</span>
          <span className="flex items-center gap-2">
            <span className="size-1.5 animate-pulse rounded-full bg-neon" /> NODE_OK · powered by Miningcore
          </span>
        </div>
      </footer>
      <Toaster />
    </div>
  );
}
