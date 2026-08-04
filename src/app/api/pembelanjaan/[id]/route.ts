import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session.userId || session.role !== "OWNER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const oldRecord = await prisma.pembelanjaan.findUnique({ where: { id } });
  if (!oldRecord) return NextResponse.json({ error: "Data tidak ditemukan" }, { status: 404 });

  const { tanggal, kategori, namaBarang, jumlah, harga, total } = await request.json();

  const newRecord = await prisma.pembelanjaan.update({
    where: { id },
    data: { tanggal: new Date(tanggal), kategori, namaBarang, jumlah, harga, total },
  });

  const fieldsToLog = ["tanggal", "kategori", "namaBarang", "jumlah", "harga", "total"];
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
        entityType: "PEMBELANJAAN",
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
  if (!session.userId || session.role !== "OWNER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const record = await prisma.pembelanjaan.findUnique({ where: { id } });
  if (!record) return NextResponse.json({ error: "Data tidak ditemukan" }, { status: 404 });

  await prisma.auditLog.create({
    data: {
      entityType: "PEMBELANJAAN",
      entityId: id,
      action: "DELETE",
      oldData: JSON.stringify({
        namaBarang: record.namaBarang,
        kategori: record.kategori,
        jumlah: record.jumlah,
        harga: record.harga,
        total: record.total,
        tanggal: record.tanggal,
      }),
      userId: session.userId,
    },
  });

  await prisma.pembelanjaan.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
