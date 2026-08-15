import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session.userId || session.role !== "OWNER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const status = request.nextUrl.searchParams.get("status") || "semua";

  const all = await prisma.pembelanjaan.findMany({
    where: { statusBayar: "KREDIT" },
    include: {
      pembayaranUtang: {
        orderBy: { tanggal: "desc" },
        include: { user: { select: { username: true } } },
      },
    },
    orderBy: { tanggal: "desc" },
  });

  const mapped = all.map((p) => {
    const totalDibayar = p.pembayaranUtang.reduce((s, b) => s + b.jumlah, 0);
    const sisa = p.total - totalDibayar;
    const lunas = sisa <= 0;
    return {
      id: p.id,
      tanggal: p.tanggal,
      namaBarang: p.namaBarang,
      kategori: p.kategori,
      jumlah: p.jumlah,
      harga: p.harga,
      total: p.total,
      sudahDibayar: totalDibayar,
      sisa,
      lunas,
      pembayaran: p.pembayaranUtang.map((b) => ({
        id: b.id,
        jumlah: b.jumlah,
        tanggal: b.tanggal,
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

  return NextResponse.json({ data: filtered });
}
