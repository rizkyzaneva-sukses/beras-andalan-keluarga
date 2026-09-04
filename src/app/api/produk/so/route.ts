import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { writeAudit } from "@/lib/audit";
import { isProdukTimbang, isValidStokCount, toQty } from "@/lib/qty";

type SoItem = {
  produkId?: string;
  nama?: string;
  stokFisik?: unknown;
};

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.userId || session.role !== "OWNER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { alasan: rawAlasan, items } = await request.json();
  const alasan = typeof rawAlasan === "string" ? rawAlasan.trim() : "";
  if (!alasan || alasan.length < 3) {
    return NextResponse.json({ error: "Alasan SO wajib diisi" }, { status: 400 });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "Tidak ada baris SO" }, { status: 400 });
  }
  if (items.length > 500) {
    return NextResponse.json({ error: "Maksimal 500 baris per SO" }, { status: 400 });
  }

  const produkList = await prisma.produk.findMany({
    where: { aktif: true },
    select: { id: true, nama: true, satuan: true, stok: true, tipe: true },
  });
  const byId = new Map(produkList.map((p) => [p.id, p]));
  const byName = new Map(produkList.map((p) => [p.nama.trim().toLowerCase(), p]));

  const prepared: {
    id: string;
    nama: string;
    satuan: string;
    stokSistem: number;
    stokFisik: number;
    selisih: number;
  }[] = [];
  const skipped: { nama: string; alasan: string }[] = [];
  const seen = new Set<string>();

  for (const item of items as SoItem[]) {
    const produk =
      (item.produkId && byId.get(item.produkId)) ||
      (item.nama ? byName.get(String(item.nama).trim().toLowerCase()) : undefined);
    if (!produk) {
      skipped.push({ nama: String(item.nama || item.produkId || "-"), alasan: "Produk tidak ditemukan" });
      continue;
    }
    if (seen.has(produk.id)) {
      skipped.push({ nama: produk.nama, alasan: "Baris dobel, dilewati" });
      continue;
    }
    if (produk.tipe === "GABUNGAN") {
      skipped.push({ nama: produk.nama, alasan: "Produk gabungan dilewati (stok dari resep)" });
      continue;
    }
    const stokFisik = toQty(item.stokFisik);
    if (!isValidStokCount(stokFisik, { allowFraction: isProdukTimbang(produk.nama) })) {
      skipped.push({ nama: produk.nama, alasan: "Stok fisik tidak valid" });
      continue;
    }
    const stokSistem = toQty(produk.stok);
    const selisih = toQty(stokFisik - stokSistem);
    if (selisih === 0) {
      skipped.push({ nama: produk.nama, alasan: "Stok sudah sesuai" });
      continue;
    }
    seen.add(produk.id);
    prepared.push({
      id: produk.id,
      nama: produk.nama,
      satuan: produk.satuan,
      stokSistem,
      stokFisik,
      selisih,
    });
  }

  if (prepared.length === 0) {
    return NextResponse.json({ error: "Tidak ada stok yang berubah", skipped }, { status: 400 });
  }

  await prisma.$transaction(async (tx) => {
    for (const row of prepared) {
      await tx.stokAdjustment.create({
        data: {
          produkId: row.id,
          stokSistem: row.stokSistem,
          stokFisik: row.stokFisik,
          selisih: row.selisih,
          alasan,
          createdBy: session.userId!,
        },
      });
      await tx.produk.update({
        where: { id: row.id },
        data: { stok: row.stokFisik },
      });
    }
  });

  for (const row of prepared) {
    await writeAudit({
      entityType: "STOK",
      entityId: row.id,
      action: "UPDATE",
      oldData: { nama: row.nama, stok: row.stokSistem },
      newData: {
        nama: row.nama,
        arah: "adjust",
        stokSistem: row.stokSistem,
        stokFisik: row.stokFisik,
        selisih: row.selisih,
        alasan,
        stok: row.stokFisik,
      },
      userId: session.userId,
    });
  }

  return NextResponse.json({
    updated: prepared.length,
    skipped,
    items: prepared.map((row) => ({
      nama: row.nama,
      stokSistem: row.stokSistem,
      stokFisik: row.stokFisik,
      selisih: row.selisih,
    })),
  });
}
