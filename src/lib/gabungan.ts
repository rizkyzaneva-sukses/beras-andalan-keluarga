import { roundQty, toQty } from "@/lib/qty";

export const DEFAULT_ISI_PER_KARUNG = 25;
export const LANGKAH_KARUNG = 0.5;

export type QtyInput = number | string | { toNumber: () => number } | null | undefined;

export type KomponenHpp = {
  qtyPerBatch: QtyInput;
  hargaBeli: number;
  hppRataRata?: number | null;
  isiPerKarung?: QtyInput;
};

export type KomponenStok = {
  qtyPerBatch: QtyInput;
  stok: QtyInput;
  isiPerKarung?: QtyInput;
};

export type HppGabungan = {
  totalBiaya: number;
  totalKg: number;
  hppPerKg: number;
};

/** Harga satuan karung: HPP rata-rata kalau ada, fallback harga beli. */
export function unitCostKomponen(p: { hargaBeli: number; hppRataRata?: number | null }) {
  const hpp = Number(p.hppRataRata ?? 0);
  if (Number.isFinite(hpp) && hpp > 0) return Math.round(hpp);
  return Math.round(Number(p.hargaBeli) || 0);
}

export function isiKarung(value: QtyInput) {
  const n = toQty(value);
  return n > 0 ? n : DEFAULT_ISI_PER_KARUNG;
}

/** Campuran beras hanya kelipatan 1/2 karung (0.5, 1, 1.5, …). */
export function isKelipatanSetengahKarung(qty: unknown) {
  const q = toQty(qty);
  if (q <= 0) return false;
  return Math.abs(q * 2 - Math.round(q * 2)) < 1 / 1000;
}

export function formatKarungQty(value: unknown) {
  const n = toQty(value);
  const halves = Math.round(n * 2);
  if (Math.abs(n * 2 - halves) > 1 / 1000) return n.toLocaleString("id-ID", { maximumFractionDigits: 3 });
  const whole = Math.floor(halves / 2);
  const half = halves % 2 === 1;
  if (whole === 0 && half) return "½";
  if (half) return `${whole}½`;
  return String(whole);
}

export function totalKgResep(items: { qtyPerBatch: QtyInput; isiPerKarung?: QtyInput }[]) {
  let total = 0;
  for (const item of items) {
    const qty = toQty(item.qtyPerBatch);
    if (qty <= 0) continue;
    total += isiKarung(item.isiPerKarung) * qty;
  }
  return roundQty(total);
}

export function totalBiayaResep(items: KomponenHpp[]) {
  let total = 0;
  for (const item of items) {
    const qty = toQty(item.qtyPerBatch);
    if (qty <= 0) continue;
    total += unitCostKomponen(item) * qty;
  }
  return Math.round(total);
}

/**
 * HPP produk gabungan per kg.
 * Contoh: A 1 karung + B 1 karung + C ½ karung, masing-masing Rp 100.000 / karung 25 kg
 * → modal Rp 250.000 / 62,5 kg = Rp 4.000 / kg
 */
export function hitungHppGabungan(items: KomponenHpp[]): HppGabungan {
  const cleaned = items.filter((item) => toQty(item.qtyPerBatch) > 0);
  const totalBiaya = totalBiayaResep(cleaned);
  const totalKg = totalKgResep(cleaned);
  if (totalKg <= 0 || totalBiaya <= 0) {
    return { totalBiaya, totalKg, hppPerKg: 0 };
  }
  return {
    totalBiaya,
    totalKg,
    hppPerKg: Math.round(totalBiaya / totalKg),
  };
}

/** Stok gabungan dalam kg: berapa kg campuran yang bisa dibuat dari stok karung. */
export function hitungStokGabunganKg(items: KomponenStok[]) {
  const cleaned = items.filter((item) => toQty(item.qtyPerBatch) > 0);
  const totalKg = totalKgResep(cleaned);
  if (totalKg <= 0 || cleaned.length === 0) return 0;

  let batches = Number.POSITIVE_INFINITY;
  for (const item of cleaned) {
    const qty = toQty(item.qtyPerBatch);
    const b = toQty(item.stok) / qty;
    if (b < batches) batches = b;
  }
  if (!Number.isFinite(batches) || batches <= 0) return 0;
  return roundQty(batches * totalKg);
}

export function langkahKarung(current: unknown, arah: 1 | -1) {
  const n = toQty(current);
  const next = roundQty(Math.max(LANGKAH_KARUNG, n + arah * LANGKAH_KARUNG));
  return isKelipatanSetengahKarung(next) ? next : LANGKAH_KARUNG;
}
