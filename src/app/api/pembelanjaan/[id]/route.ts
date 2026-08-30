import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { diffFields, writeAudit } from "@/lib/audit";
import { isProdukTimbang, isValidQty, lineTotal, toQty } from "@/lib/qty";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session.userId || session.role !== "OWNER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const oldRecord = await prisma.pembelanjaan.findUnique({ where: { id } });
  if (!oldRecord) return NextResponse.json({ error: "Data tidak ditemukan" }, { status: 404 });

  const { tanggal, kategori, namaBarang, jumlah: rawJumlah, harga, total, statusBayar, produkId } = await request.json();
  const jumlah = toQty(rawJumlah);
  const allowFraction = isProdukTimbang(namaBarang);
  if (
    !isValidQty(jumlah, { allowFraction }) ||
    !Number.isInteger(harga) ||
    harga <= 0 ||
    !Number.isInteger(total) ||
    total !== lineTotal(jumlah, harga)
  ) {
    return NextResponse.json({ error: "Perhitungan pengeluaran tidak valid" }, { status: 400 });
  }

  const newRecord = await prisma.pembelanjaan.update({
    where: { id },
    data: {
      tanggal: new Date(tanggal),
      kategori,
      namaBarang,
      jumlah,
      harga,
      total,
      statusBayar: statusBayar || oldRecord.statusBayar,
      produkId: typeof produkId === "string" && produkId ? produkId : oldRecord.produkId,
    },
  });

  const { oldData, newData, hasChanges } = diffFields(
    oldRecord as unknown as Record<string, unknown>,
    newRecord as unknown as Record<string, unknown>,
    ["tanggal", "kategori", "namaBarang", "jumlah", "harga", "total", "statusBayar"],
  );

  if (hasChanges) {
    await writeAudit({
      entityType: "PEMBELANJAAN",
      entityId: id,
      action: "UPDATE",
      oldData,
      newData,
      userId: session.userId,
    });
  }

  // Handle stock adjustments for RESTOCK changes
  const oldJumlah = toQty(oldRecord.jumlah);
  const newJumlah = toQty(newRecord.jumlah);
  if (oldRecord.kategori === "RESTOCK" && newRecord.kategori === "RESTOCK") {
    if (oldRecord.produkId && newRecord.produkId && oldRecord.produkId === newRecord.produkId) {
      if (oldJumlah !== newJumlah) {
        const diff = toQty(newJumlah - oldJumlah);
        await prisma.produk.update({
          where: { id: newRecord.produkId },
          data: { stok: { increment: diff } },
        }).catch(() => {});
      }
    } else {
      if (oldRecord.produkId) {
        await prisma.produk.update({
          where: { id: oldRecord.produkId },
          data: { stok: { decrement: oldJumlah } },
        }).catch(() => {});
      }
      if (newRecord.produkId) {
        await prisma.produk.update({
          where: { id: newRecord.produkId },
          data: { stok: { increment: newJumlah } },
        }).catch(() => {});
      }
    }
  } else if (oldRecord.kategori === "RESTOCK" && newRecord.kategori !== "RESTOCK" && oldRecord.produkId) {
    await prisma.produk.update({
      where: { id: oldRecord.produkId },
      data: { stok: { decrement: oldJumlah } },
    }).catch(() => {});
  } else if (oldRecord.kategori !== "RESTOCK" && newRecord.kategori === "RESTOCK" && newRecord.produkId) {
    await prisma.produk.update({
      where: { id: newRecord.produkId },
      data: { stok: { increment: newJumlah } },
    }).catch(() => {});
  }

  return NextResponse.json(newRecord);
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session.userId || session.role !== "OWNER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const record = await prisma.pembelanjaan.findUnique({ where: { id } });
  if (!record) return NextResponse.json({ error: "Data tidak ditemukan" }, { status: 404 });

  await writeAudit({
    entityType: "PEMBELANJAAN",
    entityId: id,
    action: "DELETE",
    oldData: {
      namaBarang: record.namaBarang,
      kategori: record.kategori,
      jumlah: record.jumlah,
      harga: record.harga,
      total: record.total,
      tanggal: record.tanggal,
    },
    userId: session.userId,
  });

  await prisma.pembayaranUtang.deleteMany({ where: { pembelanjaanId: id } });

  await prisma.pembelanjaan.delete({ where: { id } });

  // Bug #10: Revert stock if this was a RESTOCK with a linked product
  if (record.kategori === "RESTOCK" && record.produkId) {
    await prisma.produk.update({
      where: { id: record.produkId },
      data: { stok: { decrement: record.jumlah } },
    }).catch(() => {});
  }

  return NextResponse.json({ success: true });
}
