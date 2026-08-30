import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import bcrypt from "bcryptjs";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.userId || session.role !== "OWNER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const mode = body?.mode === "transaksi" ? "transaksi" : "total";

  try {
    if (mode === "transaksi") {
      // Mode 1: Hapus seluruh riwayat transaksi, reset stok produk ke 0, produk & user tetap ada
      await prisma.$transaction(async (tx) => {
        await tx.pembayaranPiutang.deleteMany();
        await tx.pembayaranUtang.deleteMany();
        await tx.penjualan.deleteMany();
        await tx.piutang.deleteMany();
        await tx.pembelanjaan.deleteMany();
        await tx.modalLog.deleteMany();
        await tx.stokAdjustment.deleteMany();
        await tx.auditLog.deleteMany();
        // Reset stok semua produk menjadi 0
        await tx.produk.updateMany({
          data: { stok: 0, hppRataRata: 0 },
        });
      });

      return NextResponse.json({
        success: true,
        message: "Data transaksi, keuangan, dan stok telah direset menjadi 0. Katalog produk dan akun user tetap tersimpan.",
      });
    }

    // Mode 2: Reset total pabrik
    await prisma.$transaction(async (tx) => {
      await tx.stokAdjustment.deleteMany();
      await tx.komposisiProduk.deleteMany();
      await tx.pembayaranPiutang.deleteMany();
      await tx.pembayaranUtang.deleteMany();
      await tx.auditLog.deleteMany();
      await tx.penjualan.deleteMany();
      await tx.piutang.deleteMany();
      await tx.pembelanjaan.deleteMany();
      await tx.modalLog.deleteMany();
      await tx.produk.deleteMany();
      await tx.user.deleteMany({
        where: { username: { not: "owner" } },
      });
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

    return NextResponse.json({
      success: true,
      message: "Semua data telah direset total ke setelan awal. User owner tetap ada (password: admin123).",
    });
  } catch (error) {
    console.error("[reset/POST] Error:", error);
    return NextResponse.json({ error: "Gagal mereset data: " + (error instanceof Error ? error.message : "Internal error") }, { status: 500 });
  }
}
