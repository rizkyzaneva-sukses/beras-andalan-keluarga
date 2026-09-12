import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { writeAudit } from "@/lib/audit";
import { toQty } from "@/lib/qty";
import { hitungHppGabungan, hitungStokGabunganKg, totalKgResep } from "@/lib/gabungan";
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
        include: {
          sumber: {
            select: {
              id: true,
              nama: true,
              stok: true,
              isiPerKarung: true,
              hargaBeli: true,
              hppRataRata: true,
            },
          },
        },
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
        isiPerKarung: k.sumber.isiPerKarung ? toQty(k.sumber.isiPerKarung) : null,
      })),
      stokGabungan: null as number | null,
      totalKgResep: null as number | null,
      eceranDariProduk: p.eceranDariProduk.map((e) => ({ id: e.id, nama: e.nama })),
    };

    if (p.tipe === "GABUNGAN") {
      base.satuan = "kg";
      if (p.komposisiResep.length > 0) {
        const items = p.komposisiResep.map((k) => ({
          qtyPerBatch: k.qtyPerBatch,
          stok: k.sumber.stok,
          isiPerKarung: k.sumber.isiPerKarung,
          hargaBeli: k.sumber.hargaBeli,
          hppRataRata: k.sumber.hppRataRata,
        }));
        const hpp = hitungHppGabungan(items);
        if (hpp.hppPerKg > 0) {
          base.hargaBeli = hpp.hppPerKg;
          base.hppRataRata = hpp.hppPerKg;
        }
        base.totalKgResep = hpp.totalKg;
        // Stok GABUNGAN independen — ambil dari field stok, bukan dari resep
        base.stokGabungan = toQty(p.stok);
      }
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
  let finalSatuan = satuan;
  if (tipE === "GABUNGAN") {
    try {
      const hpp = await resolveHargaBeliGabungan(prisma, komposisi);
      finalHargaBeli = hpp.hppPerKg;
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Gagal hitung harga beli dari resep" },
        { status: 400 },
      );
    }
    finalSatuan = "kg";
  }

  const produk = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const created = await tx.produk.create({
      data: {
        nama,
        satuan: finalSatuan,
        hargaBeli: finalHargaBeli,
        hargaJual: Number(hargaJual),
        hppRataRata: tipE === "GABUNGAN" ? finalHargaBeli : 0,
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

    // Kurangi stok sumber karung saat membuat produk GABUNGAN
    if (tipE === "GABUNGAN" && komposisi) {
      const sumberMap = new Map<string, { stok: number; isiPerKarung: number | null }>();
      for (const k of komposisi) {
        const qty = Number(k.qtyPerBatch);
        if (!qty || qty <= 0) continue;

        const sumber = await tx.produk.findUnique({
          where: { id: k.sumberId },
          select: { id: true, nama: true, stok: true, isiPerKarung: true },
        });

        if (!sumber) {
          throw new Error(`Produk sumber tidak ditemukan: ${k.sumberId}`);
        }
        if (toQty(sumber.stok) < qty) {
          throw new Error(
            `Stok ${sumber.nama} tidak cukup (${toQty(sumber.stok)} karung, butuh ${qty})`,
          );
        }

        await tx.produk.update({
          where: { id: k.sumberId },
          data: { stok: { decrement: qty } },
        });
        sumberMap.set(k.sumberId, {
          stok: toQty(sumber.stok) - qty,
          isiPerKarung: sumber.isiPerKarung ? toQty(sumber.isiPerKarung) : null,
        });
      }

      // Set stok GABUNGAN = totalKg dari resep (stok independen)
      const totalKg = totalKgResep(
        komposisi.map((k: { sumberId: string; qtyPerBatch: number }) => ({
          qtyPerBatch: k.qtyPerBatch,
          isiPerKarung: sumberMap.get(k.sumberId)?.isiPerKarung ?? null,
        })),
      );
      if (totalKg > 0) {
        await tx.produk.update({
          where: { id: created.id },
          data: { stok: totalKg },
        });
      }
    }

    return created;
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
