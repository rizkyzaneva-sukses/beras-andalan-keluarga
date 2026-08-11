"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";

interface NavUser {
  username: string;
  role: "OWNER" | "KASIR";
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<NavUser | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        if (data.user) setUser(data.user);
        else router.push("/login");
      });
  }, [router]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  if (!user) return null;

  const isKasir = user.role === "KASIR";

  const navItems = [
    { href: "/pos", label: "POS", ownerOnly: false },
    { href: "/dashboard", label: "Dashboard", ownerOnly: true },
    { href: "/closing", label: "Closing", ownerOnly: true },
    { href: "/pembelanjaan", label: "Pengeluaran", ownerOnly: true },
    { href: "/utang", label: "Utang", ownerOnly: true },
    { href: "/produk", label: "Produk", ownerOnly: true },
    { href: "/users", label: "User", ownerOnly: true },
    { href: "/barcode", label: "Barcode", ownerOnly: true },
    { href: "/modal", label: "Modal", ownerOnly: true },
    { href: "/audit", label: "Audit", ownerOnly: true },
  ];

  const visibleItems = navItems.filter((item) => !item.ownerOnly || !isKasir);

  return (
    <div className="min-h-dvh flex flex-col bg-muted/30">
      <header className="bg-primary text-white px-4 py-3 flex items-center justify-between sticky top-0 z-10 shadow-md">
        <div>
          <h1 className="text-base font-bold leading-tight">Beras Andalan</h1>
          <p className="text-[11px] opacity-75">{user.username} · {user.role === "OWNER" ? "Pemilik" : "Kasir"}</p>
        </div>
        <button onClick={handleLogout} className="text-xs bg-white/15 px-3 py-1.5 rounded-lg hover:bg-white/25 active:bg-white/30 transition-colors">
          Keluar
        </button>
      </header>

      <nav className="bg-white border-b border-border sticky top-0 z-10 shadow-sm">
        <div className="flex gap-0.5 px-2 py-1.5 overflow-x-auto scrollbar-none">
          {visibleItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`px-3.5 py-2 rounded-lg text-[13px] font-medium whitespace-nowrap transition-colors shrink-0 ${
                pathname.startsWith(item.href)
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted active:bg-border"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </nav>

      <main className="flex-1 p-3 sm:p-4 pb-20">{children}</main>
    </div>
  );
}
