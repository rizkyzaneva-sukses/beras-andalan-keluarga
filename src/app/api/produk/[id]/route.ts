import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { diffFields, writeAudit } from "@/lib/audit";
import { toQty } from "@/lib/qty";
import { resolveHargaBeliGabungan } from "@/lib/harga-beli-gabungan";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session.userId || session.role !== "OWNER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const oldRecord = await prisma.produk.findUnique({ where: { id } });
  if (!oldRecord) return NextResponse.json({ error: "Data tidak ditemukan" }, { status: 404 });

  const body = await request.json();
  const { nama, satuan, hargaBeli, hargaJual, tipe, isiPerKarung, sumberProdukId, komposisi } = body;

  const tipE = tipe || oldRecord.tipe;
  let finalHargaBeli = hargaBeli != null ? Number(hargaBeli) : oldRecord.hargaBeli;
  let finalSatuan = satuan;
  let finalHpp: number | undefined;

  if (tipE === "GABUNGAN") {
    const resep = Array.isArray(komposisi)
      ? komposisi
      : (
          await prisma.komposisiProduk.findMany({
            where: { produkId: id },
            select: { sumberId: true, qtyPerBatch: true },
          })
        ).map((k) => ({ sumberId: k.sumberId, qtyPerBatch: Number(k.qtyPerBatch) }));

    try {
      const hpp = await resolveHargaBeliGabungan(prisma, resep);
      finalHargaBeli = hpp.hppPerKg;
      finalHpp = hpp.hppPerKg;
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Gagal hitung harga beli dari resep" },
        { status: 400 },
      );
    }
    finalSatuan = "kg";
  }

  // Update base product
  const produk = await prisma.produk.update({
    where: { id },
    data: {
      nama,
      satuan: finalSatuan,
      hargaBeli: finalHargaBeli,
      hargaJual: hargaJual != null ? Number(hargaJual) : undefined,
      hppRataRata: finalHpp,
      tipe: tipE,
      isiPerKarung: tipE === "KARUNG" && isiPerKarung ? Number(isiPerKarung) : tipE === "ECERAN" || tipE === "GABUNGAN" ? null : undefined,
      sumberProdukId: tipE === "ECERAN" ? sumberProdukId : tipE === "GABUNGAN" || tipE === "KARUNG" ? null : undefined,
    },
  });

  // Update komposisi if GABUNGAN
  if (tipE === "GABUNGAN" && Array.isArray(komposisi)) {
    // Delete old, create new
    await prisma.komposisiProduk.deleteMany({ where: { produkId: id } });
    if (komposisi.length > 0) {
      await prisma.komposisiProduk.createMany({
        data: komposisi.map((k: { sumberId: string; qtyPerBatch: number }) => ({
          produkId: id,
          sumberId: k.sumberId,
          qtyPerBatch: Number(k.qtyPerBatch),
        })),
      });
    }
  } else if (tipE === "ECERAN" || tipE === "KARUNG") {
    // Remove any komposisi if switching away from GABUNGAN
    await prisma.komposisiProduk.deleteMany({ where: { produkId: id } });
  }

  const { oldData, newData, hasChanges } = diffFields(
    oldRecord as unknown as Record<string, unknown>,
    produk as unknown as Record<string, unknown>,
    ["nama", "satuan", "hargaBeli", "hargaJual", "tipe", "isiPerKarung", "sumberProdukId"],
  );
  if (hasChanges) {
    await writeAudit({
      entityType: "PRODUK",
      entityId: id,
      action: "UPDATE",
      oldData,
      newData,
      userId: session.userId,
    });
  }
  return NextResponse.json({ ...produk, stok: toQty(produk.stok) });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session.userId || session.role !== "OWNER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const record = await prisma.produk.findUnique({ where: { id } });
  if (!record) return NextResponse.json({ error: "Data tidak ditemukan" }, { status: 404 });

  await prisma.produk.update({
    where: { id },
    data: { aktif: false },
  });
  await writeAudit({
    entityType: "PRODUK",
    entityId: id,
    action: "DELETE",
    oldData: { nama: record.nama, satuan: record.satuan, hargaBeli: record.hargaBeli, hargaJual: record.hargaJual },
    userId: session.userId,
  });
  return NextResponse.json({ success: true });
}
