import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { toQty } from "@/lib/qty";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session.userId || session.role !== "OWNER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const produkId = searchParams.get("produkId");
  const limitRaw = Number(searchParams.get("limit") || 40);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 100) : 40;

  const data = await prisma.stokAdjustment.findMany({
    where: produkId ? { produkId } : undefined,
    include: {
      produk: { select: { nama: true, satuan: true } },
      user: { select: { username: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return NextResponse.json({
    data: data.map((row) => ({
      id: row.id,
      produkId: row.produkId,
      produkNama: row.produk.nama,
      satuan: row.produk.satuan,
      stokSistem: toQty(row.stokSistem),
      stokFisik: toQty(row.stokFisik),
      selisih: toQty(row.selisih),
      alasan: row.alasan,
      createdBy: row.createdBy,
      createdByUsername: row.user.username,
      createdAt: row.createdAt,
    })),
  });
}
