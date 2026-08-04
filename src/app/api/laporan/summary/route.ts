import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session.userId || session.role !== "OWNER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if (!from || !to) {
    return NextResponse.json({ error: "Rentang tanggal wajib diisi" }, { status: 400 });
  }

  const dateFrom = new Date(from);
  dateFrom.setDate(dateFrom.getDate() - 1);
  const dateTo = new Date(to);
  dateTo.setDate(dateTo.getDate() + 1);

  const [penjualanAgg, pembelanjaanAgg, modalAgg] = await Promise.all([
    prisma.penjualan.aggregate({
      _sum: { total: true },
      where: { tanggal: { gte: dateFrom, lte: dateTo } },
    }),
    prisma.pembelanjaan.aggregate({
      _sum: { total: true },
      where: { tanggal: { gte: dateFrom, lte: dateTo } },
    }),
    prisma.modalLog.aggregate({
      _sum: { jumlah: true },
      where: { tanggal: { lte: dateTo } },
    }),
  ]);

  const totalPendapatan = penjualanAgg._sum.total || 0;
  const totalPengeluaran = pembelanjaanAgg._sum.total || 0;
  const labaRugi = totalPendapatan - totalPengeluaran;
  const totalModal = modalAgg._sum.jumlah || 0;
  const saldoKas = totalModal + totalPendapatan - totalPengeluaran;

  return NextResponse.json({ totalPendapatan, totalPengeluaran, labaRugi, totalModal, saldoKas });
}
