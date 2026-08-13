import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import bcrypt from "bcryptjs";

export async function POST() {
  const session = await getSession();
  if (!session.userId || session.role !== "OWNER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  await prisma.pembayaranUtang.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.penjualan.deleteMany();
  await prisma.pembelanjaan.deleteMany();
  await prisma.modalLog.deleteMany();
  await prisma.produk.deleteMany();
  await prisma.user.deleteMany({
    where: { username: { not: "owner" } },
  });

  const owner = await prisma.user.findUnique({ where: { username: "owner" } });
  if (!owner) {
    await prisma.user.create({
      data: {
        username: "owner",
        passwordHash: await bcrypt.hash("admin123", 10),
        role: "OWNER",
      },
    });
  }

  return NextResponse.json({ success: true, message: "Semua data telah direset. User owner tetap ada (password: admin123)." });
}
