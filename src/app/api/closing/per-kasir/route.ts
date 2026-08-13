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
  const fromDate = new Date(`${from}T00:00:00.000Z`);
  const toDateExclusive = new Date(`${to}T00:00:00.000Z`);
  toDateExclusive.setUTCDate(toDateExclusive.getUTCDate() + 1);

  const [users, penjualan] = await Promise.all([
    prisma.user.findMany({
      where: {
        OR: [
          { isActive: true },
          { penjualan: { some: { tanggal: { gte: fromDate, lt: toDateExclusive } } } },
        ],
      },
      select: { id: true, username: true, role: true, isActive: true },
    }),
    prisma.penjualan.findMany({
      where: { tanggal: { gte: fromDate, lt: toDateExclusive } },
      select: { createdBy: true, metodeBayar: true, total: true, qty: true },
    }),
  ]);

  const result = users
    .map((u) => {
      const userSales = penjualan.filter((p) => p.createdBy === u.id);
      const cash = userSales.filter((p) => p.metodeBayar === "CASH").reduce((s, p) => s + p.total, 0);
      const transfer = userSales.filter((p) => p.metodeBayar === "TRANSFER").reduce((s, p) => s + p.total, 0);
      const qris = userSales.filter((p) => p.metodeBayar === "QRIS").reduce((s, p) => s + p.total, 0);
      return {
        userId: u.id,
        username: u.username,
        role: u.role,
        isActive: u.isActive,
        cashTotal: cash,
        transferTotal: transfer,
        qrisTotal: qris,
        total: cash + transfer + qris,
        transaksi: userSales.length,
        qty: userSales.reduce((s, p) => s + p.qty, 0),
      };
    })
    .sort((a, b) => b.total - a.total || a.username.localeCompare(b.username));

  return NextResponse.json({ data: result });
}
