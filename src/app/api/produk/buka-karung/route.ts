import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { writeAudit } from "@/lib/audit";
import { toQty, hasEnoughStock, formatQty } from "@/lib/qty";

// POST: Buka 1 karung → tambah stok ke produk eceran yang terkait
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.userId || session.role !== "OWNER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { karungId } = await request.json();
  if (!karungId) {
    return NextResponse.json({ error: "Pilih produk karung" }, { status: 400 });
  }

  const karung = await prisma.produk.findUnique({
    where: { id: karungId },
    include: { eceranDariProduk: true },
  });

  if (!karung || !karung.aktif) {
    return NextResponse.json({ error: "Produk tidak ditemukan" }, { status: 404 });
  }
  if (karung.tipe !== "KARUNG") {
    return NextResponse.json({ error: "Produk bukan tipe karung" }, { status: 400 });
  }

  const stokKarung = toQty(karung.stok);
  if (!hasEnoughStock(stokKarung, 1)) {
    return NextResponse.json({ error: `Stok ${karung.nama} hanya ${formatQty(stokKarung)} karung` }, { status: 400 });
  }

  const isiPerKarung = karung.isiPerKarung ? toQty(karung.isiPerKarung) : 25;
  const eceran = karung.eceranDariProduk[0]; // first linked eceran

  if (!eceran) {
    return NextResponse.json({
      error: `Tidak ada produk eceran yang terhubung ke ${karung.nama}. Buat produk eceran dulu.`,
    }, { status: 400 });
  }

  // Transaction: -1 karung, +isiPerKarung kg ke eceran
  const [updatedKarung, updatedEceran] = await prisma.$transaction([
    prisma.produk.update({
      where: { id: karungId },
      data: { stok: { decrement: 1 } },
    }),
    prisma.produk.update({
      where: { id: eceran.id },
      data: { stok: { increment: isiPerKarung } },
    }),
  ]);

  await writeAudit({
    entityType: "STOK",
    entityId: karungId,
    action: "UPDATE",
    oldData: { nama: karung.nama, stokKarung: stokKarung },
    newData: {
      arah: "buka_karung",
      dari: karung.nama,
      ke: eceran.nama,
      karungDibuka: 1,
      kgDitambah: isiPerKarung,
      stokKarungBaru: toQty(updatedKarung.stok),
      stokEceranBaru: toQty(updatedEceran.stok),
    },
    userId: session.userId,
  });

  return NextResponse.json({
    success: true,
    message: `1 ${karung.nama} dibuka → +${isiPerKarung} kg ke ${eceran.nama}`,
    stokKarung: toQty(updatedKarung.stok),
    stokEceran: toQty(updatedEceran.stok),
    eceranNama: eceran.nama,
    kgDitambah: isiPerKarung,
  });
}
