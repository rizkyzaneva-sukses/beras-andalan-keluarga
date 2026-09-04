import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { writeAudit } from "@/lib/audit";
import { formatQty, hasEnoughStock, isProdukTimbang, isValidQty, toQty } from "@/lib/qty";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.userId || session.role !== "OWNER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { fromId, fromQty: rawFromQty, toId, toQty: rawToQty } = await request.json();
  if (!fromId || !toId || fromId === toId) {
    return NextResponse.json({ error: "Pilih dua produk yang berbeda" }, { status: 400 });
  }

  const [from, to] = await Promise.all([
    prisma.produk.findUnique({ where: { id: fromId } }),
    prisma.produk.findUnique({ where: { id: toId } }),
  ]);
  if (!from || !to || !from.aktif || !to.aktif) {
    return NextResponse.json({ error: "Produk tidak ditemukan" }, { status: 404 });
  }
  if (from.tipe === "GABUNGAN" || to.tipe === "GABUNGAN") {
    return NextResponse.json(
      { error: "Produk gabungan tidak bisa dipindah stok langsung. Pindahkan komponen resepnya." },
      { status: 400 },
    );
  }

  const fromQty = toQty(rawFromQty);
  const toQtyVal = toQty(rawToQty);
  if (
    !isValidQty(fromQty, { allowFraction: isProdukTimbang(from.nama) }) ||
    !isValidQty(toQtyVal, { allowFraction: isProdukTimbang(to.nama) })
  ) {
    return NextResponse.json({ error: "Jumlah pindah stok tidak valid" }, { status: 400 });
  }

  const stokDari = toQty(from.stok);
  const stokKe = toQty(to.stok);
  if (!hasEnoughStock(stokDari, fromQty)) {
    return NextResponse.json({ error: `Stok ${from.nama} hanya ${formatQty(stokDari)} ${from.satuan}` }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.produk.update({ where: { id: fromId }, data: { stok: { decrement: fromQty } } }),
    prisma.produk.update({ where: { id: toId }, data: { stok: { increment: toQtyVal } } }),
  ]);

  await writeAudit({
    entityType: "STOK",
    entityId: fromId,
    action: "UPDATE",
    oldData: { nama: from.nama, stok: stokDari },
    newData: {
      arah: "pindah",
      dari: from.nama,
      ke: to.nama,
      fromQty,
      toQty: toQtyVal,
      stokDari: toQty(stokDari - fromQty),
      stokKe: toQty(stokKe + toQtyVal),
    },
    userId: session.userId,
  });

  return NextResponse.json({ success: true });
}
