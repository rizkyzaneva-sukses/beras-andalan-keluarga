"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";

interface NavUser {
  username: string;
  role: "OWNER" | "KASIR";
}

type NavItem = {
  href: string;
  label: string;
  short: string;
  ownerOnly: boolean;
  primary?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/pos", label: "POS Kasir", short: "POS", ownerOnly: false, primary: true },
  { href: "/dashboard", label: "Dashboard", short: "Home", ownerOnly: true, primary: true },
  { href: "/closing", label: "Closing", short: "Close", ownerOnly: true, primary: true },
  { href: "/pembelanjaan", label: "Pengeluaran", short: "Keluar", ownerOnly: true, primary: true },
  { href: "/utang", label: "Utang & Hutang", short: "Hutang", ownerOnly: false },
  { href: "/produk", label: "Produk", short: "Produk", ownerOnly: true },
  { href: "/users", label: "User", short: "User", ownerOnly: true },
  { href: "/barcode", label: "Barcode", short: "QR", ownerOnly: true },
  { href: "/modal", label: "Modal", short: "Modal", ownerOnly: true },
  { href: "/audit", label: "Audit", short: "Audit", ownerOnly: true },
  { href: "/panduan", label: "Panduan", short: "Bantu", ownerOnly: false },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<NavUser | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        if (data.user) setUser(data.user);
        else router.push("/login");
      });
  }, [router]);

  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  if (!user) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-9 h-9 border-[3px] border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Memuat...</p>
        </div>
      </div>
    );
  }

  const isKasir = user.role === "KASIR";
  const visible = NAV_ITEMS.filter((item) => !item.ownerOnly || !isKasir);
  const primaryItems = isKasir
    ? visible.filter((i) => i.href === "/pos" || i.href === "/utang")
    : visible.filter((i) => i.primary);
  const moreItems = isKasir
    ? visible.filter((i) => i.href !== "/pos" && i.href !== "/utang")
    : visible.filter((i) => !i.primary);
  const moreActive = moreItems.some((i) => pathname.startsWith(i.href));

  return (
    <div className="min-h-dvh flex bg-background">
      <aside className="hidden md:flex md:w-60 lg:w-64 shrink-0 flex-col border-r border-border bg-surface sticky top-0 h-dvh">
        <div className="px-5 py-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center font-bold text-lg shadow-sm">
              B
            </div>
            <div className="min-w-0">
              <p className="font-bold text-[15px] leading-tight truncate">Beras Andalan</p>
              <p className="text-xs text-muted-foreground truncate">
                {user.username} · {user.role === "OWNER" ? "Pemilik" : "Kasir"}
              </p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {visible.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  active
                    ? "bg-primary-soft text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${active ? "bg-primary" : "bg-border"}`}
                />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-border">
          <button
            onClick={handleLogout}
            className="w-full py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:bg-danger-soft hover:text-danger transition-colors"
          >
            Keluar
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 min-h-dvh">
        <header
          className="md:hidden sticky top-0 z-30 bg-primary text-white px-4 py-3 flex items-center justify-between shadow-sm"
          style={{ paddingTop: "calc(0.75rem + var(--safe-top))" }}
        >
          <div className="min-w-0">
            <h1 className="text-base font-bold leading-tight">Beras Andalan</h1>
            <p className="text-[11px] opacity-80 truncate">
              {user.username} · {user.role === "OWNER" ? "Pemilik" : "Kasir"}
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="text-xs bg-white/15 px-3 py-2 rounded-xl hover:bg-white/25 active:bg-white/30 transition-colors font-medium"
          >
            Keluar
          </button>
        </header>

        <header className="hidden md:flex sticky top-0 z-20 bg-surface/90 backdrop-blur border-b border-border px-6 py-3.5 items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-foreground">
              {visible.find((i) => pathname.startsWith(i.href))?.label || "Beras Andalan"}
            </p>
            <p className="text-xs text-muted-foreground">Toko beras keluarga</p>
          </div>
        </header>

        <main className="flex-1 p-3 sm:p-4 md:p-6 pb-24 md:pb-8">{children}</main>

        {!isKasir && (
          <nav
            className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-surface border-t border-border shadow-[0_-4px_20px_rgb(15_31_20/0.06)]"
            style={{ paddingBottom: "var(--safe-bottom)" }}
          >
            <div className="flex items-stretch">
              {primaryItems.map((item) => {
                const active = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 min-h-[56px] text-[11px] font-semibold transition-colors ${
                      active ? "text-primary" : "text-muted-foreground"
                    }`}
                  >
                    <span
                      className={`w-8 h-1 rounded-full mb-0.5 ${active ? "bg-primary" : "bg-transparent"}`}
                    />
                    {item.short}
                  </Link>
                );
              })}
              <button
                onClick={() => setMoreOpen((v) => !v)}
                className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 min-h-[56px] text-[11px] font-semibold transition-colors ${
                  moreOpen || moreActive ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <span
                  className={`w-8 h-1 rounded-full mb-0.5 ${moreOpen || moreActive ? "bg-primary" : "bg-transparent"}`}
                />
                Lainnya
              </button>
            </div>
          </nav>
        )}

        {isKasir && (
          <nav
            className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-surface border-t border-border shadow-[0_-4px_20px_rgb(15_31_20/0.06)]"
            style={{ paddingBottom: "var(--safe-bottom)" }}
          >
            <div className="flex items-stretch">
              {primaryItems.map((item) => {
                const active = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 min-h-[56px] text-[11px] font-semibold transition-colors ${
                      active ? "text-primary" : "text-muted-foreground"
                    }`}
                  >
                    <span className={`w-8 h-1 rounded-full mb-0.5 ${active ? "bg-primary" : "bg-transparent"}`} />
                    {item.short}
                  </Link>
                );
              })}
            </div>
          </nav>
        )}

        {moreOpen && (
          <div className="md:hidden fixed inset-0 z-50">
            <button
              className="absolute inset-0 bg-black/40"
              onClick={() => setMoreOpen(false)}
              aria-label="Tutup menu"
            />
            <div className="absolute bottom-0 inset-x-0 bg-surface rounded-t-2xl shadow-lg max-h-[70dvh] overflow-y-auto safe-pb">
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-border" />
              </div>
              <p className="px-5 pt-2 pb-3 text-sm font-semibold text-muted-foreground">Menu Lainnya</p>
              <div className="px-3 pb-4 grid grid-cols-2 gap-2">
                {moreItems.map((item) => {
                  const active = pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`rounded-xl border px-4 py-3.5 text-sm font-medium transition-colors ${
                        active
                          ? "border-primary bg-primary-soft text-primary"
                          : "border-border bg-surface text-foreground active:bg-muted"
                      }`}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
