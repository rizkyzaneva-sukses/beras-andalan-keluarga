import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { writeAudit } from "@/lib/audit";
import { formatQty, hasEnoughStock, isProdukTimbang, isValidQty, lineTotal, toQty } from "@/lib/qty";

type CheckoutItem = {
  produkId: string;
  qty: number;
  hargaJual: number;
  total: number;
  hargaDisesuaikan?: boolean;
};

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { tanggal, metodeBayar, namaPelanggan, items } = await request.json();
  if (!tanggal || !metodeBayar || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "Data transaksi tidak lengkap" }, { status: 400 });
  }
  if (!["CASH", "QRIS", "TRANSFER", "HUTANG"].includes(metodeBayar)) {
    return NextResponse.json({ error: "Metode bayar tidak valid" }, { status: 400 });
  }

  const nama = typeof namaPelanggan === "string" ? namaPelanggan.trim() : "";
  if (metodeBayar === "HUTANG" && !nama) {
    return NextResponse.json({ error: "Nama pelanggan wajib diisi untuk hutang" }, { status: 400 });
  }

  const produkIds = [...new Set((items as CheckoutItem[]).map((i) => i.produkId))];
  const produkList = await prisma.produk.findMany({
    where: { id: { in: produkIds } },
    select: { id: true, nama: true, satuan: true, stok: true },
  });
  if (produkList.length !== produkIds.length) {
    return NextResponse.json({ error: "Ada produk yang tidak ditemukan" }, { status: 400 });
  }
  const produkById = new Map(produkList.map((p) => [p.id, p]));
  const namaById = new Map(produkList.map((p) => [p.id, p.nama]));

  for (const item of items as CheckoutItem[]) {
    const produk = produkById.get(item.produkId);
    const qty = toQty(item.qty);
    const allowFraction = Boolean(produk && isProdukTimbang(produk.nama));
    if (
      !item.produkId ||
      !produk ||
      !isValidQty(qty, { allowFraction }) ||
      !Number.isInteger(item.hargaJual) ||
      item.hargaJual <= 0 ||
      !Number.isInteger(item.total) ||
      item.total <= 0
    ) {
      return NextResponse.json({ error: "Perhitungan penjualan tidak valid" }, { status: 400 });
    }
    if (!item.hargaDisesuaikan && item.total !== lineTotal(qty, item.hargaJual)) {
      return NextResponse.json({ error: "Perhitungan penjualan tidak valid" }, { status: 400 });
    }
  }

  const cartTotal = (items as CheckoutItem[]).reduce((s, i) => s + i.total, 0);

  try {
    const result = await prisma.$transaction(async (tx) => {
      let piutangId: string | null = null;
      if (metodeBayar === "HUTANG") {
        const piutang = await tx.piutang.create({
          data: {
            namaPelanggan: nama,
            tanggal: new Date(tanggal),
            total: cartTotal,
            createdBy: session.userId!,
          },
        });
        piutangId = piutang.id;
      }

      const created = [];
      const needByProduk = new Map<string, number>();
      for (const item of items as CheckoutItem[]) {
        const qty = toQty(item.qty);
        needByProduk.set(item.produkId, toQty((needByProduk.get(item.produkId) || 0) + qty));
      }

      for (const [produkId, need] of needByProduk) {
        const current = await tx.produk.findUnique({ where: { id: produkId }, select: { nama: true, satuan: true, stok: true } });
        if (!current || !hasEnoughStock(current.stok, need)) {
          const sisa = formatQty(current?.stok ?? 0);
          const satuan = current?.satuan || "";
          throw new Error(`STOK:${current?.nama || "Produk"} hanya ${sisa}${satuan ? ` ${satuan}` : ""}`);
        }
      }

      for (const item of items as CheckoutItem[]) {
        const qty = toQty(item.qty);
        const penjualan = await tx.penjualan.create({
          data: {
            tanggal: new Date(tanggal),
            produkId: item.produkId,
            qty,
            hargaJual: item.hargaJual,
            total: item.total,
            metodeBayar,
            hargaDisesuaikan: Boolean(item.hargaDisesuaikan),
            namaPelanggan: metodeBayar === "HUTANG" ? nama : null,
            piutangId,
            createdBy: session.userId!,
          },
        });
        await tx.produk.update({
          where: { id: item.produkId },
          data: { stok: { decrement: qty } },
        });
        created.push(penjualan);
      }

      return { penjualan: created, piutangId, total: cartTotal };
    });

    for (const p of result.penjualan) {
      await writeAudit({
        entityType: "PENJUALAN",
        entityId: p.id,
        action: "CREATE",
        newData: {
          produkNama: namaById.get(p.produkId),
          qty: toQty(p.qty),
          hargaJual: p.hargaJual,
          total: p.total,
          metodeBayar: p.metodeBayar,
          namaPelanggan: p.namaPelanggan,
          tanggal: p.tanggal,
        },
        userId: session.userId,
      });
    }

    if (result.piutangId) {
      await writeAudit({
        entityType: "PIUTANG",
        entityId: result.piutangId,
        action: "CREATE",
        newData: { namaPelanggan: nama, total: result.total, tanggal: new Date(tanggal) },
        userId: session.userId,
      });
    }

    return NextResponse.json(
      {
        ...result,
        penjualan: result.penjualan.map((p) => ({ ...p, qty: toQty(p.qty) })),
      },
      { status: 201 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (message.startsWith("STOK:")) {
      return NextResponse.json({ error: `Stok ${message.slice(5)}` }, { status: 400 });
    }
    return NextResponse.json({ error: "Gagal menyimpan transaksi" }, { status: 500 });
  }
}
