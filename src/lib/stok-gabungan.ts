import { Prisma, PrismaClient } from "@prisma/client";
import { totalKgResep } from "@/lib/gabungan";
import { hasEnoughStock, toQty } from "@/lib/qty";

type DbClient = PrismaClient | Prisma.TransactionClient;

export type ProdukStokMeta = {
  id: string;
  nama: string;
  satuan: string;
  tipe: string;
  komposisiResep: {
    sumberId: string;
    qtyPerBatch: Prisma.Decimal | number | string;
    sumber?: { id: string; nama: string; satuan: string | null; isiPerKarung?: Prisma.Decimal | number | string | null };
  }[];
};

export type StokDelta = {
  produkId: string;
  delta: number;
  nama: string;
  satuan: string;
};

/** Ubah qty produk menjadi delta stok fisik (GABUNGAN → komponen). */
export function expandStokDelta(meta: ProdukStokMeta, qtyDelta: number): StokDelta[] {
  const qty = toQty(qtyDelta);
  if (qty === 0) return [];

  if (meta.tipe === "GABUNGAN") {
    if (!meta.komposisiResep.length) {
      throw new Error(`STOK:${meta.nama} belum punya komposisi`);
    }
    const totalKg = totalKgResep(
      meta.komposisiResep.map((k) => ({
        qtyPerBatch: k.qtyPerBatch,
        isiPerKarung: k.sumber?.isiPerKarung,
      })),
    );
    if (totalKg <= 0) {
      throw new Error(`STOK:${meta.nama} resep belum punya isi per karung`);
    }
    // qty = kg terjual; potong karung proporsional terhadap total kg resep.
    const rasio = qty / totalKg;
    return meta.komposisiResep.map((k) => ({
      produkId: k.sumberId,
      delta: toQty(rasio * toQty(k.qtyPerBatch)),
      nama: k.sumber?.nama || meta.nama,
      satuan: k.sumber?.satuan || "",
    }));
  }

  return [
    {
      produkId: meta.id,
      delta: qty,
      nama: meta.nama,
      satuan: meta.satuan || "",
    },
  ];
}

export function mergeStokDeltas(deltas: StokDelta[]): StokDelta[] {
  const map = new Map<string, StokDelta>();
  for (const d of deltas) {
    const prev = map.get(d.produkId);
    if (prev) {
      prev.delta = toQty(prev.delta + d.delta);
    } else {
      map.set(d.produkId, { ...d, delta: toQty(d.delta) });
    }
  }
  return [...map.values()].filter((d) => d.delta !== 0);
}

/** Terapkan delta stok. delta > 0 = tambah/restock, delta < 0 = potong. */
export async function applyStokDeltas(
  tx: DbClient,
  deltas: StokDelta[],
  opts?: { checkStock?: boolean },
) {
  const checkStock = opts?.checkStock !== false;
  for (const d of deltas) {
    if (d.delta < 0 && checkStock) {
      const current = await tx.produk.findUnique({
        where: { id: d.produkId },
        select: { nama: true, satuan: true, stok: true },
      });
      const need = toQty(Math.abs(d.delta));
      if (!current || !hasEnoughStock(current.stok, need)) {
        const sisa = toQty(current?.stok ?? 0);
        const satuan = current?.satuan || d.satuan || "";
        throw new Error(
          `STOK:${current?.nama || d.nama || "Produk"} hanya ${sisa}${satuan ? ` ${satuan}` : ""}`,
        );
      }
    }

    await tx.produk.update({
      where: { id: d.produkId },
      data: { stok: { increment: d.delta } },
    });
  }
}

export async function loadProdukStokMeta(tx: DbClient, ids: string[]) {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return new Map<string, ProdukStokMeta>();

  const list = await tx.produk.findMany({
    where: { id: { in: unique } },
    select: {
      id: true,
      nama: true,
      satuan: true,
      tipe: true,
      komposisiResep: {
        select: {
          sumberId: true,
          qtyPerBatch: true,
          sumber: { select: { id: true, nama: true, satuan: true, isiPerKarung: true } },
        },
      },
    },
  });

  return new Map(list.map((p) => [p.id, p as ProdukStokMeta]));
}
