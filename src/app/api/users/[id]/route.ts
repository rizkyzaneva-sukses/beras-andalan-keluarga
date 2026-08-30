import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { writeAudit } from "@/lib/audit";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session.userId || session.role !== "OWNER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  const { id } = await params;
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return NextResponse.json({ error: "User tidak ditemukan" }, { status: 404 });
  const updated = await prisma.user.update({
    where: { id },
    data: { isActive: !user.isActive },
    select: { id: true, username: true, role: true, isActive: true },
  });
  await writeAudit({
    entityType: "USER",
    entityId: id,
    action: "UPDATE",
    oldData: { username: user.username, isActive: user.isActive },
    newData: { username: updated.username, isActive: updated.isActive },
    userId: session.userId,
  });
  return NextResponse.json({ data: updated });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session.userId || session.role !== "OWNER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  const { id } = await params;
  if (id === session.userId) {
    return NextResponse.json({ error: "Tidak bisa menghapus akun sendiri" }, { status: 400 });
  }
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return NextResponse.json({ error: "User tidak ditemukan" }, { status: 404 });
  if (user.username === "owner") return NextResponse.json({ error: "Tidak bisa menghapus akun owner utama" }, { status: 400 });

  // Check if user has related data — if so, soft-delete to avoid FK violations
  const [penjualanCount, pembelanjaanCount, modalCount] = await Promise.all([
    prisma.penjualan.count({ where: { createdBy: id } }),
    prisma.pembelanjaan.count({ where: { createdBy: id } }),
    prisma.modalLog.count({ where: { createdBy: id } }),
  ]);
  const hasRelatedData = penjualanCount + pembelanjaanCount + modalCount > 0;

  await writeAudit({
    entityType: "USER",
    entityId: id,
    action: "DELETE",
    oldData: { username: user.username, role: user.role },
    userId: session.userId,
  });

  if (hasRelatedData) {
    // Soft-delete: deactivate user to preserve FK references
    await prisma.user.update({ where: { id }, data: { isActive: false } });
  } else {
    // Safe to hard-delete: no dependent records
    await prisma.auditLog.updateMany({ where: { userId: id }, data: { userId: session.userId } });
    await prisma.user.delete({ where: { id } });
  }
  return NextResponse.json({ success: true });
}
