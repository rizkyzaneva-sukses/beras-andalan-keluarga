import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { diffFields, writeAudit } from "@/lib/audit";
import { isProdukTimbang, isValidQty, lineTotal, toQty } from "@/lib/qty";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const oldRecord = await prisma.penjualan.findUnique({ where: { id } });
  if (!oldRecord) return NextResponse.json({ error: "Data tidak ditemukan" }, { status: 404 });

  const { produkId, qty: rawQty, hargaJual, total, metodeBayar, hargaDisesuaikan } = await request.json();
  const produkCek = await prisma.produk.findUnique({ where: { id: produkId || oldRecord.produkId }, select: { nama: true } });
  const qty = toQty(rawQty);
  const allowFraction = Boolean(produkCek && isProdukTimbang(produkCek.nama));
  if (
    !isValidQty(qty, { allowFraction }) ||
    !Number.isInteger(hargaJual) ||
    hargaJual <= 0 ||
    !Number.isInteger(total) ||
    total <= 0 ||
    (!hargaDisesuaikan && total !== lineTotal(qty, hargaJual))
  ) {
    return NextResponse.json({ error: "Perhitungan penjualan tidak valid" }, { status: 400 });
  }

  const newRecord = await prisma.penjualan.update({ where: { id }, data: { produkId, qty, hargaJual, total, metodeBayar, hargaDisesuaikan } });

  const qtyLama = toQty(oldRecord.qty);
  if (qtyLama !== qty) {
    const diff = toQty(qtyLama - qty);
    await prisma.produk.update({ where: { id: oldRecord.produkId }, data: { stok: { increment: diff } } }).catch(() => {});
  }

  const { oldData, newData, hasChanges } = diffFields(
    oldRecord as unknown as Record<string, unknown>,
    newRecord as unknown as Record<string, unknown>,
    ["produkId", "qty", "hargaJual", "total", "metodeBayar", "hargaDisesuaikan"],
  );

  if (hasChanges) {
    await writeAudit({
      entityType: "PENJUALAN",
      entityId: id,
      action: "UPDATE",
      oldData,
      newData,
      userId: session.userId,
    });
  }

  return NextResponse.json(newRecord);
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const record = await prisma.penjualan.findUnique({ where: { id }, include: { produk: { select: { nama: true } } } });
  if (!record) return NextResponse.json({ error: "Data tidak ditemukan" }, { status: 404 });

  await writeAudit({
    entityType: "PENJUALAN",
    entityId: id,
    action: "DELETE",
    oldData: {
      produkNama: record.produk.nama,
      qty: record.qty,
      hargaJual: record.hargaJual,
      total: record.total,
      metodeBayar: record.metodeBayar,
      tanggal: record.tanggal,
    },
    userId: session.userId,
  });

  await prisma.penjualan.delete({ where: { id } });

  await prisma.produk.update({ where: { id: record.produkId }, data: { stok: { increment: record.qty } } }).catch(() => {});

  return NextResponse.json({ success: true });
}
