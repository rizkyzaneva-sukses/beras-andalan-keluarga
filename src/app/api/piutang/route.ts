import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { formatQty } from "@/lib/qty";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const status = request.nextUrl.searchParams.get("status") || "semua";

  const all = await prisma.piutang.findMany({
    include: {
      pembayaran: {
        orderBy: { tanggal: "desc" },
        include: { user: { select: { username: true } } },
      },
      penjualan: { include: { produk: { select: { nama: true } } } },
    },
    orderBy: { tanggal: "desc" },
  });

  const mapped = all.map((p) => {
    const sudahDibayar = p.pembayaran.reduce((s, b) => s + b.jumlah, 0);
    const sisa = p.total - sudahDibayar;
    const lunas = sisa <= 0;
    return {
      id: p.id,
      namaPelanggan: p.namaPelanggan,
      tanggal: p.tanggal,
      total: p.total,
      sudahDibayar,
      sisa,
      lunas,
      keterangan: p.keterangan,
      item: p.penjualan.map((j) => `${j.produk.nama} × ${formatQty(j.qty)}`).join(", "),
      pembayaran: p.pembayaran.map((b) => ({
        id: b.id,
        jumlah: b.jumlah,
        tanggal: b.tanggal,
        metode: b.metodeBayar,
        oleh: b.user.username,
      })),
    };
  });

  const filtered =
    status === "belum_lunas"
      ? mapped.filter((m) => !m.lunas)
      : status === "lunas"
        ? mapped.filter((m) => m.lunas)
        : mapped;

  const names = [...new Set(all.map((p) => p.namaPelanggan))].sort((a, b) => a.localeCompare(b, "id"));

  return NextResponse.json({ data: filtered, names });
}
