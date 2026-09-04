import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { writeAudit } from "@/lib/audit";
import { isProdukTimbang, isValidStokCount, toQty } from "@/lib/qty";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session.userId || session.role !== "OWNER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const { stokFisik: rawFisik, alasan: rawAlasan } = await request.json();
  const alasan = typeof rawAlasan === "string" ? rawAlasan.trim() : "";
  if (!alasan || alasan.length < 3) {
    return NextResponse.json({ error: "Alasan penyesuaian wajib diisi" }, { status: 400 });
  }
  if (rawFisik === undefined || rawFisik === null || rawFisik === "") {
    return NextResponse.json({ error: "Stok fisik wajib diisi" }, { status: 400 });
  }

  const produk = await prisma.produk.findUnique({ where: { id } });
  if (!produk || !produk.aktif) {
    return NextResponse.json({ error: "Produk tidak ditemukan" }, { status: 404 });
  }
  if (produk.tipe === "GABUNGAN") {
    return NextResponse.json(
      { error: "SO produk gabungan tidak didukung. Sesuaikan stok komponen resepnya." },
      { status: 400 },
    );
  }

  const stokFisik = toQty(rawFisik);
  if (!isValidStokCount(stokFisik, { allowFraction: isProdukTimbang(produk.nama) })) {
    return NextResponse.json({ error: "Stok fisik tidak valid" }, { status: 400 });
  }

  const stokSistem = toQty(produk.stok);
  const selisih = toQty(stokFisik - stokSistem);
  if (selisih === 0) {
    return NextResponse.json({ error: "Stok fisik sama dengan stok sistem, tidak perlu disesuaikan" }, { status: 400 });
  }

  const [adjustment] = await prisma.$transaction([
    prisma.stokAdjustment.create({
      data: {
        produkId: id,
        stokSistem,
        stokFisik,
        selisih,
        alasan,
        createdBy: session.userId,
      },
    }),
    prisma.produk.update({
      where: { id },
      data: { stok: stokFisik },
    }),
  ]);

  await writeAudit({
    entityType: "STOK",
    entityId: id,
    action: "UPDATE",
    oldData: { nama: produk.nama, stok: stokSistem },
    newData: {
      nama: produk.nama,
      arah: "adjust",
      stokSistem,
      stokFisik,
      selisih,
      alasan,
      stok: stokFisik,
    },
    userId: session.userId,
  });

  return NextResponse.json(
    {
      ...adjustment,
      stokSistem,
      stokFisik,
      selisih,
      stok: stokFisik,
    },
    { status: 201 }
  );
}
