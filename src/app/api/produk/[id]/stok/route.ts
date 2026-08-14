import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { writeAudit } from "@/lib/audit";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session.userId || session.role !== "OWNER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const { arah, jumlah, harga, statusBayar, catatan } = await request.json();
  if (!["tambah", "kurang"].includes(arah) || !Number.isInteger(jumlah) || jumlah <= 0) {
    return NextResponse.json({ error: "Jumlah stok tidak valid" }, { status: 400 });
  }

  const produk = await prisma.produk.findUnique({ where: { id } });
  if (!produk || !produk.aktif) {
    return NextResponse.json({ error: "Produk tidak ditemukan" }, { status: 404 });
  }

  if (arah === "kurang" && produk.stok < jumlah) {
    return NextResponse.json({ error: `Stok ${produk.nama} hanya ${produk.stok}` }, { status: 400 });
  }

  if (arah === "tambah") {
    const hargaBeli = Number.isInteger(harga) && harga > 0 ? harga : null;
    const stokBaru = produk.stok + jumlah;
    const hppBaru = hargaBeli
      ? produk.stok > 0
        ? Math.round(((produk.stok * (produk.hppRataRata || produk.hargaBeli)) + (jumlah * hargaBeli)) / stokBaru)
        : hargaBeli
      : produk.hppRataRata;

    await prisma.$transaction(async (tx) => {
      await tx.produk.update({
        where: { id },
        data: { stok: { increment: jumlah }, hppRataRata: hppBaru },
      });
      if (hargaBeli) {
        await tx.pembelanjaan.create({
          data: {
            tanggal: new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`),
            kategori: "RESTOCK",
            namaBarang: produk.nama,
            jumlah,
            harga: hargaBeli,
            total: jumlah * hargaBeli,
            statusBayar: statusBayar === "KREDIT" ? "KREDIT" : "CASH",
            produkId: id,
            createdBy: session.userId!,
          },
        });
      }
    });
  } else {
    await prisma.produk.update({
      where: { id },
      data: { stok: { decrement: jumlah } },
    });
  }

  await writeAudit({
    entityType: "STOK",
    entityId: id,
    action: "UPDATE",
    oldData: { nama: produk.nama, stok: produk.stok },
    newData: {
      nama: produk.nama,
      stok: arah === "tambah" ? produk.stok + jumlah : produk.stok - jumlah,
      arah,
      jumlah,
      catatan: catatan || null,
    },
    userId: session.userId,
  });

  const updated = await prisma.produk.findUnique({ where: { id } });
  return NextResponse.json(updated);
}
