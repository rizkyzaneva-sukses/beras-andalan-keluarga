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
  const oldRecord = await prisma.modalLog.findUnique({ where: { id } });
  if (!oldRecord) return NextResponse.json({ error: "Data tidak ditemukan" }, { status: 404 });

  const { jumlah, tanggal, keterangan } = await request.json();
  const newRecord = await prisma.modalLog.update({ where: { id }, data: { jumlah, tanggal: new Date(tanggal), keterangan } });

  const { oldData, newData, hasChanges } = diffFields(
    oldRecord as unknown as Record<string, unknown>,
    newRecord as unknown as Record<string, unknown>,
    ["jumlah", "tanggal", "keterangan"],
  );

  if (hasChanges) {
    await writeAudit({
      entityType: "MODAL",
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
  if (!session.userId || session.role !== "OWNER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const record = await prisma.modalLog.findUnique({ where: { id } });
  if (!record) return NextResponse.json({ error: "Data tidak ditemukan" }, { status: 404 });

  await writeAudit({
    entityType: "MODAL",
    entityId: id,
    action: "DELETE",
    oldData: { jumlah: record.jumlah, tanggal: record.tanggal, keterangan: record.keterangan },
    userId: session.userId,
  });

  await prisma.modalLog.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
