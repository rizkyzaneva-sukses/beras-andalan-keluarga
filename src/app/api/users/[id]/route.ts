import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

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
  await prisma.user.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
