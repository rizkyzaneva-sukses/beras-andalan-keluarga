import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { writeAudit } from "@/lib/audit";
import { allowsFractionQty, formatQty, hasEnoughStock, isValidQty, toQty } from "@/lib/qty";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session.userId || session.role !== "OWNER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const { arah, jumlah: rawJumlah, harga, catatan } = await request.json();
  const jumlah = toQty(rawJumlah);
  const produk = await prisma.produk.findUnique({ where: { id } });
  if (!produk || !produk.aktif) {
    return NextResponse.json({ error: "Produk tidak ditemukan" }, { status: 404 });
  }


  if (!["tambah", "kurang"].includes(arah) || !isValidQty(jumlah, { allowFraction: allowsFractionQty(produk) })) {
    return NextResponse.json({ error: "Jumlah stok tidak valid" }, { status: 400 });
  }

  const stokLama = toQty(produk.stok);
  if (arah === "kurang" && !hasEnoughStock(stokLama, jumlah)) {
    return NextResponse.json({ error: `Stok ${produk.nama} hanya ${formatQty(stokLama)} ${produk.satuan}` }, { status: 400 });
  }

  if (arah === "tambah") {
    const hargaBeli = Number.isInteger(harga) && harga > 0 ? harga : null;
    const stokBaru = toQty(stokLama + jumlah);
    const hppBaru = hargaBeli
      ? stokLama > 0
        ? Math.round((stokLama * (produk.hppRataRata || produk.hargaBeli) + jumlah * hargaBeli) / stokBaru)
        : hargaBeli
      : produk.hppRataRata;

    await prisma.produk.update({
      where: { id },
      data: { stok: { increment: jumlah }, hppRataRata: hppBaru },
    });
  } else {
    await prisma.produk.update({
      where: { id },
      data: { stok: { decrement: jumlah } },
    });
  }

  const stokBaru = arah === "tambah" ? toQty(stokLama + jumlah) : toQty(stokLama - jumlah);
  await writeAudit({
    entityType: "STOK",
    entityId: id,
    action: "UPDATE",
    oldData: { nama: produk.nama, stok: stokLama },
    newData: {
      nama: produk.nama,
      stok: stokBaru,
      arah,
      jumlah,
      catatan: catatan || null,
    },
    userId: session.userId,
  });

  const updated = await prisma.produk.findUnique({ where: { id } });
  return NextResponse.json(updated ? { ...updated, stok: toQty(updated.stok) } : updated);
}
