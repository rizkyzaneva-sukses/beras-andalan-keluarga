import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { diffFields, writeAudit } from "@/lib/audit";
import { isProdukTimbang, isValidQty, lineTotal, toQty } from "@/lib/qty";
import {
  applyStokDeltas,
  expandStokDelta,
  loadProdukStokMeta,
  mergeStokDeltas,
} from "@/lib/stok-gabungan";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const oldRecord = await prisma.penjualan.findUnique({ where: { id } });
  if (!oldRecord) return NextResponse.json({ error: "Data tidak ditemukan" }, { status: 404 });

  const { produkId, qty: rawQty, hargaJual, total, metodeBayar, hargaDisesuaikan } = await request.json();
  const nextProdukId = produkId || oldRecord.produkId;
  const produkCek = await prisma.produk.findUnique({ where: { id: nextProdukId }, select: { nama: true } });
  const qty = toQty(rawQty);
  const allowFraction = Boolean(produkCek && isProdukTimbang(produkCek.nama));
  if (
    !isValidQty(qty, { allowFraction }) ||
    !Number.isInteger(hargaJual) ||
    hargaJual <= 0 ||
    !Number.isInteger(total) ||
    total <= 0 ||
    (!hargaDisesuaikan && total !== lineTotal(qty, hargaJual))
  ) {
    return NextResponse.json({ error: "Perhitungan penjualan tidak valid" }, { status: 400 });
  }

  try {
    const newRecord = await prisma.$transaction(async (tx) => {
      const qtyLama = toQty(oldRecord.qty);
      const metaMap = await loadProdukStokMeta(tx, [oldRecord.produkId, nextProdukId]);
      const oldMeta = metaMap.get(oldRecord.produkId);
      const newMeta = metaMap.get(nextProdukId);
      if (!oldMeta || !newMeta) {
        throw new Error("STOK:Produk tidak ditemukan");
      }

      const deltas = mergeStokDeltas([
        ...expandStokDelta(oldMeta, qtyLama),
        ...expandStokDelta(newMeta, -qty),
      ]);
      await applyStokDeltas(tx, deltas, { checkStock: true });

      return tx.penjualan.update({
        where: { id },
        data: {
          produkId: nextProdukId,
          qty,
          hargaJual,
          total,
          metodeBayar,
          hargaDisesuaikan,
        },
      });
    });

    const { oldData, newData, hasChanges } = diffFields(
      oldRecord as unknown as Record<string, unknown>,
      newRecord as unknown as Record<string, unknown>,
      ["produkId", "qty", "hargaJual", "total", "metodeBayar", "hargaDisesuaikan"],
    );

    if (hasChanges) {
      await writeAudit({
        entityType: "PENJUALAN",
        entityId: id,
        action: "UPDATE",
        oldData,
        newData,
        userId: session.userId,
      });
    }

    return NextResponse.json(newRecord);
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (message.startsWith("STOK:")) {
      return NextResponse.json({ error: `Stok ${message.slice(5)}` }, { status: 400 });
    }
    return NextResponse.json({ error: "Gagal mengubah penjualan" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const record = await prisma.penjualan.findUnique({
    where: { id },
    include: { produk: { select: { nama: true } } },
  });
  if (!record) return NextResponse.json({ error: "Data tidak ditemukan" }, { status: 404 });

  try {
    await prisma.$transaction(async (tx) => {
      const metaMap = await loadProdukStokMeta(tx, [record.produkId]);
      const meta = metaMap.get(record.produkId);
      if (!meta) throw new Error("STOK:Produk tidak ditemukan");

      await applyStokDeltas(tx, expandStokDelta(meta, toQty(record.qty)), { checkStock: false });
      await tx.penjualan.delete({ where: { id } });
    });

    await writeAudit({
      entityType: "PENJUALAN",
      entityId: id,
      action: "DELETE",
      oldData: {
        produkNama: record.produk.nama,
        qty: record.qty,
        hargaJual: record.hargaJual,
        total: record.total,
        metodeBayar: record.metodeBayar,
        tanggal: record.tanggal,
      },
      userId: session.userId,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (message.startsWith("STOK:")) {
      return NextResponse.json({ error: `Stok ${message.slice(5)}` }, { status: 400 });
    }
    return NextResponse.json({ error: "Gagal menghapus penjualan" }, { status: 500 });
  }
}
