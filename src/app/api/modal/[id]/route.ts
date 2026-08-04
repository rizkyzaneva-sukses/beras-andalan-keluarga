import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

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

  const fieldsToLog = ["jumlah", "tanggal", "keterangan"];
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
        entityType: "MODAL",
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
  const record = await prisma.modalLog.findUnique({ where: { id } });
  if (!record) return NextResponse.json({ error: "Data tidak ditemukan" }, { status: 404 });

  await prisma.auditLog.create({
    data: {
      entityType: "MODAL",
      entityId: id,
      action: "DELETE",
      oldData: JSON.stringify({ jumlah: record.jumlah, tanggal: record.tanggal, keterangan: record.keterangan }),
      userId: session.userId,
    },
  });

  await prisma.modalLog.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
