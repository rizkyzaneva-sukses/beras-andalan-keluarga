import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { writeAudit } from "@/lib/audit";
import { isProdukTimbang, isValidQty, lineTotal, toQty } from "@/lib/qty";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const where: Record<string, unknown> = {};
  if (from && to) {
    const fromDate = new Date(`${from}T00:00:00.000Z`);
    const toDateExclusive = new Date(`${to}T00:00:00.000Z`);
    toDateExclusive.setUTCDate(toDateExclusive.getUTCDate() + 1);
    where.tanggal = { gte: fromDate, lt: toDateExclusive };
  }

  const data = await prisma.pembelanjaan.findMany({
    where,
    orderBy: { tanggal: "desc" },
  });
  return NextResponse.json({ data: data.map((p) => ({ ...p, jumlah: toQty(p.jumlah) })) });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.userId || session.role !== "OWNER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { tanggal, kategori, namaBarang, jumlah: rawJumlah, harga, total, statusBayar, produkId } = await request.json();
  if (!tanggal || !kategori || !namaBarang || !rawJumlah || !harga || !total) {
    return NextResponse.json({ error: "Semua field wajib diisi" }, { status: 400 });
  }
  const jumlah = toQty(rawJumlah);
  const linkedId = typeof produkId === "string" && produkId ? produkId : null;
  const linkedProduk = linkedId ? await prisma.produk.findUnique({ where: { id: linkedId }, select: { nama: true } }) : null;
  const allowFraction = isProdukTimbang(namaBarang) || Boolean(linkedProduk && isProdukTimbang(linkedProduk.nama));
  if (
    !isValidQty(jumlah, { allowFraction }) ||
    !Number.isInteger(harga) ||
    harga <= 0 ||
    !Number.isInteger(total) ||
    total !== lineTotal(jumlah, harga)
  ) {
    return NextResponse.json({ error: "Perhitungan pengeluaran tidak valid" }, { status: 400 });
  }

  const pembelanjaan = await prisma.pembelanjaan.create({
    data: {
      tanggal: new Date(tanggal),
      kategori,
      namaBarang,
      jumlah,
      harga,
      total,
      statusBayar: statusBayar || "CASH",
      produkId: linkedId,
      createdBy: session.userId,
    },
  });

  await writeAudit({
    entityType: "PEMBELANJAAN",
    entityId: pembelanjaan.id,
    action: "CREATE",
    newData: {
      namaBarang,
      kategori,
      jumlah,
      harga,
      total,
      statusBayar: pembelanjaan.statusBayar,
      tanggal: pembelanjaan.tanggal,
    },
    userId: session.userId,
  });

  if (kategori === "RESTOCK") {
    const produkList = await prisma.produk.findMany({ where: { aktif: true } });
    const matched =
      (produkId && produkList.find((p) => p.id === produkId)) ||
      produkList.find((p) => p.nama.toLowerCase() === String(namaBarang).toLowerCase()) ||
      produkList.find((p) => namaBarang.toLowerCase().includes(p.nama.toLowerCase()));
    if (matched) {
      const stokLama = toQty(matched.stok);
      const stokBaru = toQty(stokLama + jumlah);
      const hppBaru = stokLama > 0
        ? Math.round((stokLama * (matched.hppRataRata || matched.hargaBeli) + jumlah * harga) / stokBaru)
        : harga;
      await prisma.produk.update({
        where: { id: matched.id },
        data: { stok: { increment: jumlah }, hppRataRata: hppBaru },
      });
    }
  }

  return NextResponse.json(pembelanjaan, { status: 201 });
}
