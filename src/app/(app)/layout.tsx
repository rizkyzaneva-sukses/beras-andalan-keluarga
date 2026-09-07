"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { LogOut } from "lucide-react";
import { NavIcon } from "@/components/NavIcon";
import {
  currentNavItem,
  flattenNav,
  groupsForRole,
  isNavActive,
  moreItemsForRole,
  tabItemsForRole,
  type UserRole,
} from "@/lib/nav";

interface NavUser {
  username: string;
  role: UserRole;
}

interface TokoSettings {
  namaToko: string;
  slogan: string;
  logoText: string;
  logoColor: string;
  logoUrl: string;
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<NavUser | null>(null);
  const [settings, setSettings] = useState<TokoSettings>({
    namaToko: "Beras Andalan",
    slogan: "Toko beras keluarga",
    logoText: "B",
    logoColor: "#15803d",
    logoUrl: "",
  });
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        if (data.user) setUser(data.user);
        else router.push("/login");
      });

    fetch("/api/pengaturan")
      .then((r) => r.json())
      .then((json) => {
        if (json.data) {
          setSettings({
            namaToko: json.data.namaToko || "Beras Andalan",
            slogan: json.data.slogan || "Toko beras keluarga",
            logoText: json.data.logoText || "B",
            logoColor: json.data.logoColor || "#15803d",
            logoUrl: json.data.logoUrl || "",
          });
        }
      })
      .catch(() => {});
  }, [router]);

  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!user || user.role !== "KASIR") return;
    const allowed = new Set(flattenNav("KASIR").map((item) => item.href));
    const blocked = !Array.from(allowed).some((href) => isNavActive(pathname, href));
    if (blocked) router.replace("/pos");
  }, [user, pathname, router]);

  useEffect(() => {
    if (!moreOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [moreOpen]);

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

  const groups = groupsForRole(user.role);
  const tabs = tabItemsForRole(user.role);
  const moreGroups = moreItemsForRole(user.role);
  const moreItems = moreGroups.flatMap((g) => g.items);
  const moreActive = moreItems.some((i) => isNavActive(pathname, i.href));
  const current = currentNavItem(pathname, user.role);
  const pageTitle = current?.label || settings.namaToko;
  const roleLabel = user.role === "OWNER" ? "Pemilik" : "Kasir";

  return (
    <div className="min-h-dvh flex bg-background">
      <aside className="hidden md:flex md:w-60 lg:w-64 shrink-0 flex-col border-r border-border bg-surface sticky top-0 h-dvh">
        <div className="px-5 py-5 border-b border-border">
          <div className="flex items-center gap-3">
            {settings.logoUrl ? (
              <img
                src={settings.logoUrl}
                alt={settings.namaToko}
                className="w-10 h-10 rounded-xl object-cover border border-border shrink-0 shadow-sm"
              />
            ) : (
              <div
                className="w-10 h-10 rounded-xl text-white flex items-center justify-center font-bold text-lg shrink-0 shadow-sm"
                style={{ backgroundColor: settings.logoColor || "#15803d" }}
              >
                {settings.logoText || (settings.namaToko ? settings.namaToko.slice(0, 1).toUpperCase() : "B")}
              </div>
            )}
            <div className="min-w-0">
              <p className="font-bold text-[15px] leading-tight truncate">{settings.namaToko}</p>
              <p className="text-xs text-muted-foreground truncate">
                {user.username} · {roleLabel}
              </p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 overflow-y-auto">
          {groups.map((group, index) => (
            <div key={group.id} className={index > 0 ? "mt-4" : ""}>
              <p className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const active = isNavActive(pathname, item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors min-h-11 ${
                        active
                          ? "bg-primary-soft text-primary"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      <NavIcon
                        name={item.icon}
                        className="w-[18px] h-[18px] shrink-0"
                        strokeWidth={active ? 2.4 : 2}
                      />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-3 border-t border-border">
          <button
            onClick={handleLogout}
            className="w-full py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:bg-danger-soft hover:text-danger transition-colors min-h-11 inline-flex items-center justify-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            Keluar
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 min-h-dvh">
        <header
          className="md:hidden sticky top-0 z-30 bg-primary text-white px-4 flex items-center justify-between gap-3"
          style={{ paddingTop: "calc(0.7rem + var(--safe-top))", paddingBottom: "0.7rem" }}
        >
          <div className="min-w-0">
            <p className="text-[11px] text-white/75 truncate">{settings.namaToko}</p>
            <h1 className="text-base font-bold leading-tight truncate">{pageTitle}</h1>
          </div>
          <button
            onClick={handleLogout}
            className="shrink-0 min-h-11 min-w-11 px-3 rounded-xl bg-white/15 hover:bg-white/25 active:bg-white/30 transition-colors font-medium text-xs inline-flex items-center justify-center gap-1.5"
            aria-label="Keluar"
          >
            <LogOut className="w-4 h-4" />
            Keluar
          </button>
        </header>

        <header className="hidden md:flex sticky top-0 z-20 bg-surface/90 backdrop-blur border-b border-border px-6 py-3.5 items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-foreground">{pageTitle}</p>
            <p className="text-xs text-muted-foreground">{settings.slogan || "Toko beras keluarga"}</p>
          </div>
          <p className="text-xs text-muted-foreground">
            {user.username} · {roleLabel}
          </p>
        </header>

        <main className="flex-1 p-3 sm:p-4 md:p-6 pb-[calc(5.75rem+var(--safe-bottom))] md:pb-8">
          {children}
        </main>

        <nav
          className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-surface/95 backdrop-blur-md border-t border-border shadow-[0_-8px_24px_rgb(15_31_20/0.08)]"
          style={{ paddingBottom: "var(--safe-bottom)" }}
        >
          <div className="flex items-stretch px-1">
            {tabs.map((item) => {
              const active = isNavActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 min-h-[58px] text-[10px] font-semibold transition-colors ${
                    active ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  <span
                    className={`w-10 h-8 rounded-xl inline-flex items-center justify-center ${
                      active ? "bg-primary-soft" : ""
                    }`}
                  >
                    <NavIcon name={item.icon} className="w-5 h-5" strokeWidth={active ? 2.4 : 2} />
                  </span>
                  {item.short}
                </Link>
              );
            })}
            {moreItems.length > 0 && (
              <button
                onClick={() => setMoreOpen((v) => !v)}
                className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 min-h-[58px] text-[10px] font-semibold transition-colors ${
                  moreOpen || moreActive ? "text-primary" : "text-muted-foreground"
                }`}
                aria-label="Menu lainnya"
                aria-expanded={moreOpen}
              >
                <span
                  className={`w-10 h-8 rounded-xl inline-flex items-center justify-center ${
                    moreOpen || moreActive ? "bg-primary-soft" : ""
                  }`}
                >
                  <NavIcon name="more" className="w-5 h-5" strokeWidth={moreOpen || moreActive ? 2.4 : 2} />
                </span>
                Menu
              </button>
            )}
          </div>
        </nav>

        {moreOpen && (
          <div className="md:hidden fixed inset-0 z-50">
            <button className="absolute inset-0 bg-black/45" onClick={() => setMoreOpen(false)} aria-label="Tutup menu" />
            <div className="absolute bottom-0 inset-x-0 bg-surface rounded-t-3xl shadow-lg max-h-[78dvh] overflow-y-auto safe-pb">
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-border" />
              </div>
              <div className="px-5 pt-1 pb-2">
                <p className="text-base font-bold">Menu {roleLabel}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Dikelompokkan sesuai pekerjaan {roleLabel.toLowerCase()}</p>
              </div>
              <div className="px-3 pb-5 space-y-4">
                {moreGroups.map((group) => (
                  <div key={group.id}>
                    <p className="px-2 pb-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                      {group.label}
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {group.items.map((item) => {
                        const active = isNavActive(pathname, item.href);
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            className={`min-h-[72px] rounded-2xl border px-3.5 py-3 text-sm font-medium transition-colors flex flex-col justify-center gap-1.5 ${
                              active
                                ? "border-primary bg-primary-soft text-primary"
                                : "border-border bg-surface text-foreground active:bg-muted"
                            }`}
                          >
                            <NavIcon name={item.icon} className="w-5 h-5" strokeWidth={active ? 2.4 : 2} />
                            {item.label}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
