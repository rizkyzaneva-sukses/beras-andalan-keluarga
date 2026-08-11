import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();
  if (!session.userId || session.role !== "OWNER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  const all = await prisma.pembelanjaan.findMany({
    where: { statusBayar: "KREDIT" },
    include: { pembayaranUtang: true },
    orderBy: { tanggal: "desc" },
  });
  const utang = all.filter((p) => {
    const totalDibayar = p.pembayaranUtang.reduce((s, b) => s + b.jumlah, 0);
    return totalDibayar < p.total;
  });
  const mapped = utang.map((p) => {
    const totalDibayar = p.pembayaranUtang.reduce((s, b) => s + b.jumlah, 0);
    return { ...p, sudahDibayar: totalDibayar, pembayaranUtang: undefined };
  });
  return NextResponse.json({ data: mapped });
}
