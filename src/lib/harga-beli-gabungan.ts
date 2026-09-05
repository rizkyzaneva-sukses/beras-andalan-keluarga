import { Prisma, PrismaClient } from "@prisma/client";
import { toQty } from "@/lib/qty";
import { hitungHppGabungan, isKelipatanSetengahKarung, type QtyInput } from "@/lib/gabungan";

type DbClient = PrismaClient | Prisma.TransactionClient;

export type KomposisiInput = {
  sumberId: string;
  qtyPerBatch: number | string;
};

export { hitungHppGabungan, unitCostKomponen } from "@/lib/gabungan";

/** @deprecated pakai hitungHppGabungan — hasilnya HPP per kg, bukan total batch. */
export function hitungHargaBeliDariKomposisi(
  items: { qtyPerBatch: QtyInput; hargaBeli: number; hppRataRata?: number | null; isiPerKarung?: QtyInput }[],
) {
  return hitungHppGabungan(items).hppPerKg;
}

export async function resolveHargaBeliGabungan(tx: DbClient, komposisi: KomposisiInput[]) {
  const cleaned = (komposisi || [])
    .map((k) => ({ sumberId: String(k.sumberId || ""), qtyPerBatch: k.qtyPerBatch }))
    .filter((k) => k.sumberId && toQty(k.qtyPerBatch) > 0);

  if (cleaned.length === 0) {
    throw new Error("Produk gabungan harus punya minimal 1 komposisi");
  }

  for (const k of cleaned) {
    if (!isKelipatanSetengahKarung(k.qtyPerBatch)) {
      throw new Error("Jumlah campuran harus kelipatan ½ karung atau 1 karung");
    }
  }

  const ids = [...new Set(cleaned.map((k) => k.sumberId))];
  const sumberList = await tx.produk.findMany({
    where: { id: { in: ids }, aktif: true },
    select: { id: true, nama: true, tipe: true, hargaBeli: true, hppRataRata: true, isiPerKarung: true },
  });
  const byId = new Map(sumberList.map((s) => [s.id, s]));

  const missing = ids.filter((id) => !byId.has(id));
  if (missing.length) {
    throw new Error("Komponen resep tidak ditemukan / nonaktif");
  }

  const bukanKarung = sumberList.filter((s) => s.tipe !== "KARUNG");
  if (bukanKarung.length) {
    throw new Error(`Komponen resep harus produk karung (${bukanKarung.map((s) => s.nama).join(", ")})`);
  }

  const hpp = hitungHppGabungan(
    cleaned.map((k) => {
      const s = byId.get(k.sumberId)!;
      return {
        qtyPerBatch: k.qtyPerBatch,
        hargaBeli: s.hargaBeli,
        hppRataRata: s.hppRataRata,
        isiPerKarung: s.isiPerKarung,
      };
    }),
  );

  if (!hpp.hppPerKg || hpp.hppPerKg <= 0 || hpp.totalKg <= 0) {
    throw new Error("HPP dari resep tidak valid — cek harga beli dan isi per karung komponen");
  }

  return hpp;
}
