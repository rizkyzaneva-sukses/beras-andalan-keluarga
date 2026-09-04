import { Prisma, PrismaClient } from "@prisma/client";
import { toQty } from "@/lib/qty";

type DbClient = PrismaClient | Prisma.TransactionClient;

export type KomposisiInput = {
  sumberId: string;
  qtyPerBatch: number | string;
};

/** Harga satuan komponen: pakai HPP rata-rata kalau ada, fallback harga beli. */
export function unitCostKomponen(p: { hargaBeli: number; hppRataRata?: number | null }) {
  const hpp = Number(p.hppRataRata ?? 0);
  if (Number.isFinite(hpp) && hpp > 0) return Math.round(hpp);
  return Math.round(Number(p.hargaBeli) || 0);
}

/**
 * Harga beli 1 unit produk GABUNGAN = Σ (harga satuan komponen × qty per batch).
 * Satuan mengikuti stok komponen (kg/karung/pcs) — sama seperti pemotongan stok resep.
 */
export function hitungHargaBeliDariKomposisi(
  items: { qtyPerBatch: number | string; hargaBeli: number; hppRataRata?: number | null }[],
) {
  if (!items.length) return 0;
  let total = 0;
  for (const item of items) {
    const qty = toQty(item.qtyPerBatch);
    if (qty <= 0) continue;
    total += unitCostKomponen(item) * qty;
  }
  return Math.round(total);
}

export async function resolveHargaBeliGabungan(tx: DbClient, komposisi: KomposisiInput[]) {
  const cleaned = (komposisi || [])
    .map((k) => ({ sumberId: String(k.sumberId || ""), qtyPerBatch: k.qtyPerBatch }))
    .filter((k) => k.sumberId && toQty(k.qtyPerBatch) > 0);

  if (cleaned.length === 0) {
    throw new Error("Produk gabungan harus punya minimal 1 komposisi");
  }

  const ids = [...new Set(cleaned.map((k) => k.sumberId))];
  const sumberList = await tx.produk.findMany({
    where: { id: { in: ids }, aktif: true },
    select: { id: true, nama: true, hargaBeli: true, hppRataRata: true },
  });
  const byId = new Map(sumberList.map((s) => [s.id, s]));

  const missing = ids.filter((id) => !byId.has(id));
  if (missing.length) {
    throw new Error("Komponen resep tidak ditemukan / nonaktif");
  }

  return hitungHargaBeliDariKomposisi(
    cleaned.map((k) => {
      const s = byId.get(k.sumberId)!;
      return {
        qtyPerBatch: k.qtyPerBatch,
        hargaBeli: s.hargaBeli,
        hppRataRata: s.hppRataRata,
      };
    }),
  );
}
