import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const oldRecord = await prisma.penjualan.findUnique({ where: { id } });
  if (!oldRecord) return NextResponse.json({ error: "Data tidak ditemukan" }, { status: 404 });

  const { produkId, qty, hargaJual, total, metodeBayar, hargaDisesuaikan } = await request.json();
  if (!Number.isInteger(qty) || qty <= 0 || !Number.isInteger(hargaJual) || hargaJual <= 0 || total !== qty * hargaJual) {
    return NextResponse.json({ error: "Perhitungan penjualan tidak valid" }, { status: 400 });
  }

  const newRecord = await prisma.penjualan.update({ where: { id }, data: { produkId, qty, hargaJual, total, metodeBayar, hargaDisesuaikan } });

  if (oldRecord.qty !== qty) {
    const diff = oldRecord.qty - qty;
    await prisma.produk.update({ where: { id: oldRecord.produkId }, data: { stok: { increment: diff } } }).catch(() => {});
  }

  const fieldsToLog = ["produkId", "qty", "hargaJual", "total", "metodeBayar", "hargaDisesuaikan"];
  const oldData: Record<string, unknown> = {};
  const newData: Record<string, unknown> = {};
  let hasChanges = false;

  for (const f of fieldsToLog) {
    const oldVal = (oldRecord as Record<string, unknown>)[f];
    const newVal = (newRecord as Record<string, unknown>)[f];
    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      oldData[f] = oldVal;
      newData[f] = newVal;
      hasChanges = true;
    }
  }

  if (hasChanges) {
    await prisma.auditLog.create({
      data: {
        entityType: "PENJUALAN",
        entityId: id,
        action: "UPDATE",
        oldData: JSON.stringify(oldData),
        newData: JSON.stringify(newData),
        userId: session.userId,
      },
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

  await prisma.auditLog.create({
    data: {
      entityType: "PENJUALAN",
      entityId: id,
      action: "DELETE",
      oldData: JSON.stringify({
        produkNama: record.produk.nama,
        qty: record.qty,
        hargaJual: record.hargaJual,
        total: record.total,
        metodeBayar: record.metodeBayar,
        tanggal: record.tanggal,
      }),
      userId: session.userId,
    },
  });

  await prisma.penjualan.delete({ where: { id } });

  await prisma.produk.update({ where: { id: record.produkId }, data: { stok: { increment: record.qty } } }).catch(() => {});

  return NextResponse.json({ success: true });
}
