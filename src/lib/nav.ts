export type UserRole = "OWNER" | "KASIR";

export type NavIcon =
  | "home"
  | "pos"
  | "closing"
  | "produk"
  | "barcode"
  | "pengeluaran"
  | "utang"
  | "modal"
  | "users"
  | "audit"
  | "pengaturan"
  | "panduan"
  | "more";

export type NavItem = {
  href: string;
  label: string;
  short: string;
  icon: NavIcon;
  roles: UserRole[];
};

export type NavGroup = {
  id: string;
  label: string;
  items: NavItem[];
};

export const NAV_GROUPS: NavGroup[] = [
  {
    id: "kasir",
    label: "Kasir",
    items: [
      { href: "/dashboard", label: "Dashboard", short: "Home", icon: "home", roles: ["OWNER"] },
      { href: "/pos", label: "POS Kasir", short: "Kasir", icon: "pos", roles: ["OWNER", "KASIR"] },
      { href: "/closing", label: "Closing", short: "Close", icon: "closing", roles: ["OWNER"] },
    ],
  },
  {
    id: "stok",
    label: "Stok",
    items: [
      { href: "/produk", label: "Produk & Stok", short: "Stok", icon: "produk", roles: ["OWNER"] },
      { href: "/barcode", label: "Cetak Barcode", short: "QR", icon: "barcode", roles: ["OWNER"] },
    ],
  },
  {
    id: "keuangan",
    label: "Keuangan",
    items: [
      { href: "/pembelanjaan", label: "Pengeluaran", short: "Keluar", icon: "pengeluaran", roles: ["OWNER"] },
      { href: "/utang", label: "Utang & Hutang", short: "Hutang", icon: "utang", roles: ["OWNER", "KASIR"] },
      { href: "/modal", label: "Modal", short: "Modal", icon: "modal", roles: ["OWNER"] },
    ],
  },
  {
    id: "sistem",
    label: "Sistem",
    items: [
      { href: "/users", label: "Kelola User", short: "User", icon: "users", roles: ["OWNER"] },
      { href: "/audit", label: "Audit Trail", short: "Audit", icon: "audit", roles: ["OWNER"] },
      { href: "/pengaturan", label: "Pengaturan", short: "Set", icon: "pengaturan", roles: ["OWNER"] },
      { href: "/panduan", label: "Panduan", short: "Bantu", icon: "panduan", roles: ["OWNER", "KASIR"] },
    ],
  },
];

const OWNER_TAB_HREFS = ["/dashboard", "/pos", "/produk", "/utang"] as const;
const KASIR_TAB_HREFS = ["/pos", "/utang", "/panduan"] as const;

export function flattenNav(role: UserRole): NavItem[] {
  return NAV_GROUPS.flatMap((group) => group.items.filter((item) => item.roles.includes(role)));
}

export function groupsForRole(role: UserRole): NavGroup[] {
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => item.roles.includes(role)),
  })).filter((group) => group.items.length > 0);
}

export function tabItemsForRole(role: UserRole): NavItem[] {
  const all = flattenNav(role);
  const hrefs = role === "KASIR" ? KASIR_TAB_HREFS : OWNER_TAB_HREFS;
  return hrefs
    .map((href) => all.find((item) => item.href === href))
    .filter((item): item is NavItem => Boolean(item));
}

export function moreItemsForRole(role: UserRole): NavGroup[] {
  const tabs = new Set(tabItemsForRole(role).map((item) => item.href));
  return groupsForRole(role)
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => !tabs.has(item.href)),
    }))
    .filter((group) => group.items.length > 0);
}

export function currentNavItem(pathname: string, role: UserRole): NavItem | undefined {
  return flattenNav(role)
    .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0];
}

export function isNavActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}
