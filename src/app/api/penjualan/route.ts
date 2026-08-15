import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { writeAudit } from "@/lib/audit";
import { hasEnoughStock, isProdukTimbang, isValidQty, lineTotal, toQty } from "@/lib/qty";

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
    include: {
      produk: { select: { nama: true } },
      user: { select: { username: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const mapped = data.map((p) => ({
    id: p.id,
    tanggal: p.tanggal,
    produkId: p.produkId,
    produkNama: p.produk.nama,
    qty: toQty(p.qty),
    hargaJual: p.hargaJual,
    total: p.total,
    metodeBayar: p.metodeBayar,
    hargaDisesuaikan: p.hargaDisesuaikan,
    namaPelanggan: p.namaPelanggan,
    piutangId: p.piutangId,
    createdBy: p.createdBy,
    createdByUsername: p.user.username,
  }));

  return NextResponse.json({ data: mapped });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { tanggal, produkId, qty: rawQty, hargaJual, total, metodeBayar, hargaDisesuaikan } = await request.json();
  if (!tanggal || !produkId || !rawQty || !hargaJual || !total || !metodeBayar) {
    return NextResponse.json({ error: "Semua field wajib diisi" }, { status: 400 });
  }
  const produkCek = await prisma.produk.findUnique({ where: { id: produkId } });
  const qty = toQty(rawQty);
  const allowFraction = Boolean(produkCek && isProdukTimbang(produkCek.nama));
  if (
    !produkCek ||
    !isValidQty(qty, { allowFraction }) ||
    !Number.isInteger(hargaJual) ||
    hargaJual <= 0 ||
    !Number.isInteger(total) ||
    total <= 0 ||
    (!hargaDisesuaikan && total !== lineTotal(qty, hargaJual))
  ) {
    return NextResponse.json({ error: "Perhitungan penjualan tidak valid" }, { status: 400 });
  }
  if (!hasEnoughStock(produkCek.stok, qty)) {
    return NextResponse.json({ error: `Stok ${produkCek.nama} tidak cukup` }, { status: 400 });
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

  const produk = await prisma.produk.update({
    where: { id: produkId },
    data: { stok: { decrement: qty } },
  }).catch(() => prisma.produk.findUnique({ where: { id: produkId } }));

  await writeAudit({
    entityType: "PENJUALAN",
    entityId: penjualan.id,
    action: "CREATE",
    newData: {
      produkNama: produk?.nama,
      qty,
      hargaJual,
      total,
      metodeBayar,
      tanggal: penjualan.tanggal,
    },
    userId: session.userId,
  });

  return NextResponse.json(penjualan, { status: 201 });
}
