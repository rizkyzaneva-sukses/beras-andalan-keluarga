import { Prisma, PrismaClient } from "@prisma/client";
import { hitungHppGabungan, planProduksiGabungan } from "@/lib/gabungan";
import { hasEnoughStock, toQty } from "@/lib/qty";

type DbClient = PrismaClient | Prisma.TransactionClient;

export type ProdukStokMeta = {
  id: string;
  nama: string;
  satuan: string;
  tipe: string;
  komposisiResep?: {
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

/**
 * Ubah qty produk menjadi delta stok.
 * Karung, eceran, dan gabungan punya stok masing-masing — penjualan tidak
 * merambat ke produk lain. Pemindahan karung → gabungan hanya lewat buka karung.
 */
export function expandStokDelta(meta: ProdukStokMeta, qtyDelta: number): StokDelta[] {
  const qty = toQty(qtyDelta);
  if (qty === 0) return [];

  return [
    {
      produkId: meta.id,
      delta: qty,
      nama: meta.nama,
      satuan: meta.tipe === "GABUNGAN" ? "kg" : meta.satuan || "",
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
    },
  });

  return new Map(list.map((p) => [p.id, p as ProdukStokMeta]));
}

export async function applyProduksiGabungan(tx: DbClient, gabunganId: string, jumlahBatch: number) {
  const gabungan = await tx.produk.findUnique({
    where: { id: gabunganId },
    include: {
      komposisiResep: {
        include: {
          sumber: {
            select: {
              id: true,
              nama: true,
              satuan: true,
              stok: true,
              isiPerKarung: true,
              hargaBeli: true,
              hppRataRata: true,
            },
          },
        },
      },
    },
  });

  if (!gabungan || !gabungan.aktif) {
    throw new Error("Produk tidak ditemukan");
  }
  if (gabungan.tipe !== "GABUNGAN") {
    throw new Error("Produk bukan tipe gabungan");
  }
  if (!gabungan.komposisiResep.length) {
    throw new Error("Produk gabungan belum punya komposisi");
  }

  const items = gabungan.komposisiResep.map((k) => ({
    sumberId: k.sumberId,
    nama: k.sumber.nama,
    satuan: k.sumber.satuan,
    qtyPerBatch: k.qtyPerBatch,
    stok: k.sumber.stok,
    isiPerKarung: k.sumber.isiPerKarung,
    hargaBeli: k.sumber.hargaBeli,
    hppRataRata: k.sumber.hppRataRata,
  }));

  const plan = planProduksiGabungan(items, jumlahBatch);
  const hpp = hitungHppGabungan(items);
  if (!hpp.hppPerKg || hpp.hppPerKg <= 0) {
    throw new Error("HPP dari resep tidak valid — cek harga beli dan isi per karung komponen");
  }

  const deltas: StokDelta[] = [
    ...plan.pemakaian.map((p) => ({
      produkId: p.sumberId,
      delta: -p.qty,
      nama: p.nama,
      satuan: p.satuan,
    })),
    {
      produkId: gabungan.id,
      delta: plan.kgHasil,
      nama: gabungan.nama,
      satuan: "kg",
    },
  ];
  await applyStokDeltas(tx, deltas, { checkStock: true });

  const stokLama = toQty(gabungan.stok);
  const stokBaru = toQty(stokLama + plan.kgHasil);
  const hppBaru =
    stokLama > 0
      ? Math.round((stokLama * (gabungan.hppRataRata || gabungan.hargaBeli) + plan.kgHasil * hpp.hppPerKg) / stokBaru)
      : hpp.hppPerKg;

  await tx.produk.update({
    where: { id: gabungan.id },
    data: { hppRataRata: hppBaru, hargaBeli: hpp.hppPerKg },
  });

  return {
    ...plan,
    hppPerKg: hpp.hppPerKg,
    hppRataRata: hppBaru,
    stokGabunganLama: stokLama,
    stokGabunganBaru: stokBaru,
    nama: gabungan.nama,
  };
}
