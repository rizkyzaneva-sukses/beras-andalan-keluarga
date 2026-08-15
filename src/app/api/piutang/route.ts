import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { formatQty } from "@/lib/qty";

export async function GET() {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const all = await prisma.piutang.findMany({
    include: {
      pembayaran: true,
      penjualan: { include: { produk: { select: { nama: true } } } },
    },
    orderBy: { tanggal: "desc" },
  });

  const open = all
    .map((p) => {
      const sudahDibayar = p.pembayaran.reduce((s, b) => s + b.jumlah, 0);
      return {
        id: p.id,
        namaPelanggan: p.namaPelanggan,
        tanggal: p.tanggal,
        total: p.total,
        sudahDibayar,
        keterangan: p.keterangan,
        item: p.penjualan.map((j) => `${j.produk.nama} × ${formatQty(j.qty)}`).join(", "),
      };
    })
    .filter((p) => p.sudahDibayar < p.total);

  const names = [...new Set(all.map((p) => p.namaPelanggan))].sort((a, b) => a.localeCompare(b, "id"));

  return NextResponse.json({ data: open, names });
}
