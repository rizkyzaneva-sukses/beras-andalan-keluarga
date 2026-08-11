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

  // Semua tanggal dari input date disimpan sebagai UTC midnight. Gunakan
  // rentang [awal, akhir) supaya tidak perlu menggeser tanggal +/- 1 hari.
  const dateFrom = new Date(`${from}T00:00:00.000Z`);
  const dateToExclusive = new Date(`${to}T00:00:00.000Z`);
  dateToExclusive.setUTCDate(dateToExclusive.getUTCDate() + 1);

  const [penjualanAgg, pembelanjaanCashAgg, pembayaranUtangAgg, modalAgg, penjualanSampaiAgg, pembelanjaanCashSampaiAgg, pembayaranUtangSampaiAgg] = await Promise.all([
    prisma.penjualan.aggregate({
      _sum: { total: true },
      where: { tanggal: { gte: dateFrom, lt: dateToExclusive } },
    }),
    prisma.pembelanjaan.aggregate({
      _sum: { total: true },
      where: { tanggal: { gte: dateFrom, lt: dateToExclusive }, statusBayar: "CASH" },
    }),
    prisma.pembayaranUtang.aggregate({
      _sum: { jumlah: true },
      where: { tanggal: { gte: dateFrom, lt: dateToExclusive } },
    }),
    prisma.modalLog.aggregate({
      _sum: { jumlah: true },
      where: { tanggal: { lt: dateToExclusive } },
    }),
    prisma.penjualan.aggregate({
      _sum: { total: true },
      where: { tanggal: { lt: dateToExclusive } },
    }),
    prisma.pembelanjaan.aggregate({
      _sum: { total: true },
      where: { tanggal: { lt: dateToExclusive }, statusBayar: "CASH" },
    }),
    prisma.pembayaranUtang.aggregate({
      _sum: { jumlah: true },
      where: { tanggal: { lt: dateToExclusive } },
    }),
  ]);

  const totalPendapatan = penjualanAgg._sum.total || 0;
  // Kredit bukan arus kas saat pembelian dicatat. Arus kas baru keluar saat
  // pembayaran utang dibuat.
  const totalPengeluaran = (pembelanjaanCashAgg._sum.total || 0) + (pembayaranUtangAgg._sum.jumlah || 0);
  const labaRugi = totalPendapatan - totalPengeluaran;
  const totalModal = modalAgg._sum.jumlah || 0;
  const saldoKas = totalModal
    + (penjualanSampaiAgg._sum.total || 0)
    - (pembelanjaanCashSampaiAgg._sum.total || 0)
    - (pembayaranUtangSampaiAgg._sum.jumlah || 0);

  console.info("[laporan/summary] cash-basis calculation", {
    from,
    to,
    totalPendapatan,
    cashPurchasePeriod: pembelanjaanCashAgg._sum.total || 0,
    debtPaymentPeriod: pembayaranUtangAgg._sum.jumlah || 0,
    totalModal,
    saldoKas,
  });

  return NextResponse.json({ totalPendapatan, totalPengeluaran, labaRugi, totalModal, saldoKas });
}
