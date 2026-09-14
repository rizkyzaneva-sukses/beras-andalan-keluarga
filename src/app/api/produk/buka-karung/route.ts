import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { writeAudit } from "@/lib/audit";
import { applyProduksiGabungan } from "@/lib/stok-gabungan";
import { formatKarungQty } from "@/lib/gabungan";
import { toQty, hasEnoughStock, formatQty } from "@/lib/qty";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.userId || session.role !== "OWNER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await request.json();
  const { karungId, eceranId, gabunganId, jumlahBatch } = body;

  if (gabunganId) {
    return produksiGabungan(session.userId, gabunganId, jumlahBatch);
  }

  if (!karungId) {
    return NextResponse.json({ error: "Pilih produk karung atau gabungan" }, { status: 400 });
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
  const linked = karung.eceranDariProduk;
  if (!linked.length) {
    return NextResponse.json({
      error: `Tidak ada produk eceran yang terhubung ke ${karung.nama}. Buat produk eceran dulu.`,
    }, { status: 400 });
  }
  const eceran = (typeof eceranId === "string" && eceranId
    ? linked.find((p) => p.id === eceranId)
    : linked[0]) || null;
  if (!eceran) {
    return NextResponse.json({ error: "Pilih produk eceran tujuan yang tertaut ke karung ini" }, { status: 400 });
  }

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

async function produksiGabungan(userId: string, gabunganId: string, rawBatch: unknown) {
  const jumlahBatch = Number(rawBatch ?? 1);
  if (!Number.isInteger(jumlahBatch) || jumlahBatch <= 0 || jumlahBatch > 999) {
    return NextResponse.json({ error: "Jumlah batch harus bilangan bulat 1–999" }, { status: 400 });
  }

  try {
    const result = await prisma.$transaction((tx) => applyProduksiGabungan(tx, gabunganId, jumlahBatch));

    await writeAudit({
      entityType: "STOK",
      entityId: gabunganId,
      action: "UPDATE",
      oldData: { nama: result.nama, stokGabungan: result.stokGabunganLama },
      newData: {
        arah: "buka_karung_gabungan",
        ke: result.nama,
        jumlahBatch: result.jumlahBatch,
        kgDitambah: result.kgHasil,
        pemakaian: result.pemakaian.map((p) => ({
          nama: p.nama,
          qty: p.qty,
        })),
        stokGabunganBaru: result.stokGabunganBaru,
        hppRataRata: result.hppRataRata,
      },
      userId,
    });

    const pemakaianText = result.pemakaian
      .map((p) => `${p.nama} ${formatKarungQty(p.qty)}`)
      .join(" + ");

    return NextResponse.json({
      success: true,
      message: `${result.jumlahBatch} batch dibuka (${pemakaianText}) → +${formatQty(result.kgHasil)} kg ke ${result.nama}`,
      stokGabungan: result.stokGabunganBaru,
      kgDitambah: result.kgHasil,
      jumlahBatch: result.jumlahBatch,
      pemakaian: result.pemakaian,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (message.startsWith("STOK:")) {
      return NextResponse.json({ error: `Stok ${message.slice(5)}` }, { status: 400 });
    }
    if (
      message.includes("komposisi") ||
      message.includes("batch") ||
      message.includes("resep") ||
      message.includes("HPP") ||
      message.includes("tipe") ||
      message.includes("tidak ditemukan")
    ) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    return NextResponse.json({ error: "Gagal buka karung gabungan" }, { status: 500 });
  }
}
