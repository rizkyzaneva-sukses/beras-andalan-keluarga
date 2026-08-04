import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const where: Record<string, unknown> = {};
  if (from && to) {
    const fromDate = new Date(from);
    fromDate.setDate(fromDate.getDate() - 1);
    const toDate = new Date(to);
    toDate.setDate(toDate.getDate() + 1);
    where.tanggal = { gte: fromDate, lte: toDate };
  }

  const data = await prisma.pembelanjaan.findMany({
    where,
    orderBy: { tanggal: "desc" },
  });
  return NextResponse.json({ data });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.userId || session.role !== "OWNER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { tanggal, kategori, namaBarang, jumlah, harga, total } = await request.json();
  if (!tanggal || !kategori || !namaBarang || !jumlah || !harga || !total) {
    return NextResponse.json({ error: "Semua field wajib diisi" }, { status: 400 });
  }

  const pembelanjaan = await prisma.pembelanjaan.create({
    data: {
      tanggal: new Date(tanggal),
      kategori,
      namaBarang,
      jumlah,
      harga,
      total,
      createdBy: session.userId,
    },
  });
  return NextResponse.json(pembelanjaan, { status: 201 });
}
