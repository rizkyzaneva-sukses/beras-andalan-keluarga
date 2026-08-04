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

  const [penjualan, pembelanjaan] = await Promise.all([
    prisma.penjualan.findMany({ where: { tanggal: { gte: dateFrom, lte: dateTo } }, orderBy: { tanggal: "asc" } }),
    prisma.pembelanjaan.findMany({ where: { tanggal: { gte: dateFrom, lte: dateTo } }, orderBy: { tanggal: "asc" } }),
  ]);

  const dayMap = new Map<string, { pendapatan: number; pengeluaran: number }>();

  for (const p of penjualan) {
    const d = p.tanggal.toISOString().slice(0, 10);
    const entry = dayMap.get(d) || { pendapatan: 0, pengeluaran: 0 };
    entry.pendapatan += p.total;
    dayMap.set(d, entry);
  }

  for (const p of pembelanjaan) {
    const d = p.tanggal.toISOString().slice(0, 10);
    const entry = dayMap.get(d) || { pendapatan: 0, pengeluaran: 0 };
    entry.pengeluaran += p.total;
    dayMap.set(d, entry);
  }

  const result = Array.from(dayMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([tanggal, val]) => ({
      tanggal,
      pendapatan: val.pendapatan,
      pengeluaran: val.pengeluaran,
      labaRugi: val.pendapatan - val.pengeluaran,
    }));

  return NextResponse.json({ data: result });
}
