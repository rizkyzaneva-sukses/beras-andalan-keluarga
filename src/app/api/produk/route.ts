import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { writeAudit } from "@/lib/audit";
import { toQty } from "@/lib/qty";
import { resolveHargaBeliGabungan } from "@/lib/harga-beli-gabungan";

export async function GET() {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const produk = await prisma.produk.findMany({
    where: { aktif: true },
    include: {
      sumberProduk: { select: { id: true, nama: true, stok: true, isiPerKarung: true } },
      komposisiResep: {
        include: { sumber: { select: { id: true, nama: true, stok: true, isiPerKarung: true } } },
      },
      eceranDariProduk: { select: { id: true, nama: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const mapped = produk.map((p) => {
    const base = {
      id: p.id,
      nama: p.nama,
      satuan: p.satuan,
      hargaBeli: p.hargaBeli,
      hargaJual: p.hargaJual,
      stok: toQty(p.stok),
      hppRataRata: p.hppRataRata,
      aktif: p.aktif,
      tipe: p.tipe,
      isiPerKarung: p.isiPerKarung ? toQty(p.isiPerKarung) : null,
      sumberProdukId: p.sumberProdukId,
      sumberProdukNama: p.sumberProduk?.nama ?? null,
      komposisi: p.komposisiResep.map((k) => ({
        id: k.id,
        sumberId: k.sumberId,
        sumberNama: k.sumber.nama,
        qtyPerBatch: toQty(k.qtyPerBatch),
      })),
      stokGabungan: null as number | null,
      eceranDariProduk: p.eceranDariProduk.map((e) => ({ id: e.id, nama: e.nama })),
    };

    // For GABUNGAN: calculate available stock from components
    if (p.tipe === "GABUNGAN" && p.komposisiResep.length > 0) {
      const batches = p.komposisiResep.map((k) => {
        const sumberStok = toQty(k.sumber.stok);
        const qty = toQty(k.qtyPerBatch);
        return qty > 0 ? Math.floor(sumberStok / qty) : 0;
      });
      base.stokGabungan = Math.min(...batches);
    }

    return base;
  });

  return NextResponse.json(mapped);
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.userId || session.role !== "OWNER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await request.json();
  const { nama, satuan, hargaBeli, hargaJual, tipe, isiPerKarung, sumberProdukId, komposisi } = body;

  const tipE = tipe || "KARUNG";

  if (!nama || !satuan || !hargaJual) {
    return NextResponse.json({ error: "Semua field wajib diisi" }, { status: 400 });
  }
  if (tipE !== "GABUNGAN" && (hargaBeli == null || hargaBeli === "")) {
    return NextResponse.json({ error: "Harga beli wajib diisi" }, { status: 400 });
  }

  if (tipE === "ECERAN" && !sumberProdukId) {
    return NextResponse.json({ error: "Produk eceran harus punya sumber karung" }, { status: 400 });
  }
  if (tipE === "GABUNGAN" && (!komposisi || komposisi.length === 0)) {
    return NextResponse.json({ error: "Produk gabungan harus punya minimal 1 komposisi" }, { status: 400 });
  }

  let finalHargaBeli = Number(hargaBeli);
  if (tipE === "GABUNGAN") {
    try {
      finalHargaBeli = await resolveHargaBeliGabungan(prisma, komposisi);
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Gagal hitung harga beli dari resep" },
        { status: 400 },
      );
    }
    if (!finalHargaBeli || finalHargaBeli <= 0) {
      return NextResponse.json({ error: "Harga beli dari resep tidak valid" }, { status: 400 });
    }
  }

  const produk = await prisma.produk.create({
    data: {
      nama,
      satuan,
      hargaBeli: finalHargaBeli,
      hargaJual: Number(hargaJual),
      tipe: tipE,
      isiPerKarung: tipE === "KARUNG" && isiPerKarung ? Number(isiPerKarung) : null,
      sumberProdukId: tipE === "ECERAN" ? sumberProdukId : null,
      komposisiResep:
        tipE === "GABUNGAN" && komposisi
          ? {
              create: komposisi.map((k: { sumberId: string; qtyPerBatch: number }) => ({
                sumberId: k.sumberId,
                qtyPerBatch: Number(k.qtyPerBatch),
              })),
            }
          : undefined,
    },
  });

  await writeAudit({
    entityType: "PRODUK",
    entityId: produk.id,
    action: "CREATE",
    newData: { nama, satuan, hargaBeli: finalHargaBeli, hargaJual, tipe: tipE },
    userId: session.userId,
  });

  return NextResponse.json(produk, { status: 201 });
}
