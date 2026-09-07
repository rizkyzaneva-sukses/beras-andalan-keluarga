import type { LucideIcon } from "lucide-react";
import {
  Banknote,
  Barcode,
  CircleHelp,
  ClipboardCheck,
  HandCoins,
  LayoutDashboard,
  MoreHorizontal,
  Package,
  ScrollText,
  Settings,
  ShoppingCart,
  Users,
  Wallet,
} from "lucide-react";
import type { NavIcon as NavIconName } from "@/lib/nav";

const ICONS: Record<NavIconName, LucideIcon> = {
  home: LayoutDashboard,
  pos: ShoppingCart,
  closing: ClipboardCheck,
  produk: Package,
  barcode: Barcode,
  pengeluaran: Wallet,
  utang: HandCoins,
  modal: Banknote,
  users: Users,
  audit: ScrollText,
  pengaturan: Settings,
  panduan: CircleHelp,
  more: MoreHorizontal,
};

export function NavIcon({
  name,
  className = "w-5 h-5",
  strokeWidth = 2,
}: {
  name: NavIconName;
  className?: string;
  strokeWidth?: number;
}) {
  const Icon = ICONS[name];
  return <Icon className={className} strokeWidth={strokeWidth} aria-hidden />;
}
