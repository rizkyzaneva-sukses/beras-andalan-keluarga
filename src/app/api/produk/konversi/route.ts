import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { writeAudit } from "@/lib/audit";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.userId || session.role !== "OWNER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { fromId, fromQty, toId, toQty } = await request.json();
  if (!fromId || !toId || fromId === toId) {
    return NextResponse.json({ error: "Pilih dua produk yang berbeda" }, { status: 400 });
  }
  if (!Number.isInteger(fromQty) || fromQty <= 0 || !Number.isInteger(toQty) || toQty <= 0) {
    return NextResponse.json({ error: "Jumlah pindah stok tidak valid" }, { status: 400 });
  }

  const [from, to] = await Promise.all([
    prisma.produk.findUnique({ where: { id: fromId } }),
    prisma.produk.findUnique({ where: { id: toId } }),
  ]);
  if (!from || !to || !from.aktif || !to.aktif) {
    return NextResponse.json({ error: "Produk tidak ditemukan" }, { status: 404 });
  }
  if (from.stok < fromQty) {
    return NextResponse.json({ error: `Stok ${from.nama} hanya ${from.stok}` }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.produk.update({ where: { id: fromId }, data: { stok: { decrement: fromQty } } }),
    prisma.produk.update({ where: { id: toId }, data: { stok: { increment: toQty } } }),
  ]);

  await writeAudit({
    entityType: "STOK",
    entityId: fromId,
    action: "UPDATE",
    oldData: { nama: from.nama, stok: from.stok },
    newData: {
      arah: "pindah",
      dari: from.nama,
      ke: to.nama,
      fromQty,
      toQty,
      stokDari: from.stok - fromQty,
      stokKe: to.stok + toQty,
    },
    userId: session.userId,
  });

  return NextResponse.json({ success: true });
}
