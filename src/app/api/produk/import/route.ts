import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { writeAudit } from "@/lib/audit";
import { validateBarisImport, type TabelBaris } from "@/lib/import-tabel";
import { toQty } from "@/lib/qty";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.userId || session.role !== "OWNER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await request.json();
  const items = Array.isArray(body.items) ? (body.items as TabelBaris[]) : [];
  if (items.length === 0) {
    return NextResponse.json({ error: "Tidak ada baris untuk diimpor" }, { status: 400 });
  }
  if (items.length > 500) {
    return NextResponse.json({ error: "Maksimal 500 baris per unggahan" }, { status: 400 });
  }

  const existing = await prisma.produk.findMany({
    where: { aktif: true },
    select: { id: true, nama: true },
  });
  const byName = new Map(existing.map((p) => [p.nama.trim().toLowerCase(), p]));
  const seen = new Set<string>();

  const created: { nama: string; stok: number }[] = [];
  const skipped: { nama: string; alasan: string }[] = [];

  for (const raw of items) {
    const row = validateBarisImport({
      baris: raw.baris || 0,
      nama: String(raw.nama || "").trim(),
      satuan: String(raw.satuan || "").trim(),
      jumlah: toQty(raw.jumlah),
      hpp: Number(raw.hpp),
      hargaJual: Number(raw.hargaJual),
      error: raw.error,
    });
    if (row.error) {
      skipped.push({ nama: row.nama || `(baris ${row.baris})`, alasan: row.error });
      continue;
    }
    const key = row.nama.toLowerCase();
    if (seen.has(key) || byName.has(key)) {
      skipped.push({ nama: row.nama, alasan: "Produk sudah ada" });
      continue;
    }
    seen.add(key);

    const produk = await prisma.produk.create({
      data: {
        nama: row.nama,
        satuan: row.satuan,
        hargaBeli: row.hpp,
        hargaJual: row.hargaJual,
        stok: row.jumlah,
        hppRataRata: row.hpp,
      },
    });
    byName.set(key, { id: produk.id, nama: produk.nama });
    created.push({ nama: row.nama, stok: row.jumlah });
    await writeAudit({
      entityType: "PRODUK",
      entityId: produk.id,
      action: "CREATE",
      newData: {
        nama: row.nama,
        satuan: row.satuan,
        hargaBeli: row.hpp,
        hargaJual: row.hargaJual,
        stok: row.jumlah,
        sumber: "import",
      },
      userId: session.userId,
    });
  }

  return NextResponse.json({ created: created.length, skipped, items: created }, { status: 201 });
}
