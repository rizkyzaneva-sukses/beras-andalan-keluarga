import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { diffFields, writeAudit } from "@/lib/audit";
import { toQty } from "@/lib/qty";

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

  // Update base product
  const produk = await prisma.produk.update({
    where: { id },
    data: {
      nama,
      satuan,
      hargaBeli: hargaBeli != null ? Number(hargaBeli) : undefined,
      hargaJual: hargaJual != null ? Number(hargaJual) : undefined,
      tipe: tipe || undefined,
      isiPerKarung: tipe === "KARUNG" && isiPerKarung ? Number(isiPerKarung) : tipe === "ECERAN" || tipe === "GABUNGAN" ? null : undefined,
      sumberProdukId: tipe === "ECERAN" ? sumberProdukId : tipe === "GABUNGAN" || tipe === "KARUNG" ? null : undefined,
    },
  });

  // Update komposisi if GABUNGAN
  if (tipe === "GABUNGAN" && Array.isArray(komposisi)) {
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
  } else if (tipe === "ECERAN" || tipe === "KARUNG") {
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
