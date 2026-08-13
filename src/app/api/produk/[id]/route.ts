import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { diffFields, writeAudit } from "@/lib/audit";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session.userId || session.role !== "OWNER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const oldRecord = await prisma.produk.findUnique({ where: { id } });
  if (!oldRecord) return NextResponse.json({ error: "Data tidak ditemukan" }, { status: 404 });

  const { nama, satuan, hargaBeli, hargaJual } = await request.json();

  const produk = await prisma.produk.update({
    where: { id },
    data: { nama, satuan, hargaBeli, hargaJual },
  });

  const { oldData, newData, hasChanges } = diffFields(
    oldRecord as unknown as Record<string, unknown>,
    produk as unknown as Record<string, unknown>,
    ["nama", "satuan", "hargaBeli", "hargaJual"],
  );
  if (hasChanges) {
    await writeAudit({
      entityType: "PRODUK",
      entityId: id,
      action: "UPDATE",
      oldData,
      newData,
      userId: session.userId,
    });
  }
  return NextResponse.json(produk);
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session.userId || session.role !== "OWNER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const record = await prisma.produk.findUnique({ where: { id } });
  if (!record) return NextResponse.json({ error: "Data tidak ditemukan" }, { status: 404 });

  await prisma.produk.update({
    where: { id },
    data: { aktif: false },
  });
  await writeAudit({
    entityType: "PRODUK",
    entityId: id,
    action: "DELETE",
    oldData: { nama: record.nama, satuan: record.satuan, hargaBeli: record.hargaBeli, hargaJual: record.hargaJual },
    userId: session.userId,
  });
  return NextResponse.json({ success: true });
}
