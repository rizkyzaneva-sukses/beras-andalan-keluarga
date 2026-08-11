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

  const data = await prisma.penjualan.findMany({
    where,
    include: { produk: { select: { nama: true } } },
    orderBy: { createdAt: "desc" },
  });

  const mapped = data.map((p) => ({
    id: p.id,
    tanggal: p.tanggal,
    produkId: p.produkId,
    produkNama: p.produk.nama,
    qty: p.qty,
    hargaJual: p.hargaJual,
    total: p.total,
    metodeBayar: p.metodeBayar,
    hargaDisesuaikan: p.hargaDisesuaikan,
    createdBy: p.createdBy,
  }));

  return NextResponse.json({ data: mapped });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { tanggal, produkId, qty, hargaJual, total, metodeBayar, hargaDisesuaikan } = await request.json();
  if (!tanggal || !produkId || !qty || !hargaJual || !total || !metodeBayar) {
    return NextResponse.json({ error: "Semua field wajib diisi" }, { status: 400 });
  }
  if (!Number.isInteger(qty) || qty <= 0 || !Number.isInteger(hargaJual) || hargaJual <= 0 || total !== qty * hargaJual) {
    return NextResponse.json({ error: "Perhitungan penjualan tidak valid" }, { status: 400 });
  }

  const penjualan = await prisma.penjualan.create({
    data: {
      tanggal: new Date(tanggal),
      produkId,
      qty,
      hargaJual,
      total,
      metodeBayar,
      hargaDisesuaikan: hargaDisesuaikan || false,
      createdBy: session.userId,
    },
  });

  await prisma.produk.update({ where: { id: produkId }, data: { stok: { decrement: qty } } }).catch(() => {});

  return NextResponse.json(penjualan, { status: 201 });
}
