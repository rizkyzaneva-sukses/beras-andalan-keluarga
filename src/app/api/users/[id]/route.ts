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
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return NextResponse.json({ error: "User tidak ditemukan" }, { status: 404 });
  if (user.username === "owner") return NextResponse.json({ error: "Tidak bisa menghapus akun owner utama" }, { status: 400 });
  await writeAudit({
    entityType: "USER",
    entityId: id,
    action: "DELETE",
    oldData: { username: user.username, role: user.role },
    userId: session.userId,
  });
  await prisma.auditLog.updateMany({ where: { userId: id }, data: { userId: session.userId } });
  await prisma.user.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
