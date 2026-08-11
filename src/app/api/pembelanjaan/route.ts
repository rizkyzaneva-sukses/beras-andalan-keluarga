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
    const fromDate = new Date(`${from}T00:00:00.000Z`);
    const toDateExclusive = new Date(`${to}T00:00:00.000Z`);
    toDateExclusive.setUTCDate(toDateExclusive.getUTCDate() + 1);
    where.tanggal = { gte: fromDate, lt: toDateExclusive };
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

  const { tanggal, kategori, namaBarang, jumlah, harga, total, statusBayar } = await request.json();
  if (!tanggal || !kategori || !namaBarang || !jumlah || !harga || !total) {
    return NextResponse.json({ error: "Semua field wajib diisi" }, { status: 400 });
  }
  if (!Number.isInteger(jumlah) || jumlah <= 0 || !Number.isInteger(harga) || harga <= 0 || total !== jumlah * harga) {
    return NextResponse.json({ error: "Perhitungan pengeluaran tidak valid" }, { status: 400 });
  }

  const pembelanjaan = await prisma.pembelanjaan.create({
    data: {
      tanggal: new Date(tanggal),
      kategori,
      namaBarang,
      jumlah,
      harga,
      total,
      statusBayar: statusBayar || "CASH",
      createdBy: session.userId,
    },
  });

  if (kategori === "RESTOCK") {
    const produkList = await prisma.produk.findMany({ where: { aktif: true } });
    const matched = produkList.find((p) => namaBarang.toLowerCase().includes(p.nama.toLowerCase()));
    if (matched) {
      const stokBaru = matched.stok + jumlah;
      const hppBaru = matched.stok > 0
        ? Math.round(((matched.stok * (matched.hppRataRata || matched.hargaBeli)) + (jumlah * harga)) / stokBaru)
        : harga;
      await prisma.produk.update({
        where: { id: matched.id },
        data: { stok: { increment: jumlah }, hppRataRata: hppBaru },
      });
    }
  }

  return NextResponse.json(pembelanjaan, { status: 201 });
}
