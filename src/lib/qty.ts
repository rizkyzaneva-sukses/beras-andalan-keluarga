export const QTY_SCALE = 3;
const QTY_FACTOR = 10 ** QTY_SCALE;

export const TELUR_PRESETS = [
  { label: "1/4", qty: 0.25 },
  { label: "1/3", qty: 0.333 },
  { label: "1/2", qty: 0.5 },
  { label: "1", qty: 1 },
] as const;

export function isProdukTimbang(nama: string) {
  return /telur/i.test(nama || "");
}

export function roundQty(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * QTY_FACTOR) / QTY_FACTOR;
}

export function toQty(value: unknown): number {
  if (value == null || value === "") return 0;
  if (typeof value === "number") return Number.isFinite(value) ? roundQty(value) : 0;
  if (typeof value === "string") {
    const n = Number(value.replace(",", "."));
    return Number.isFinite(n) ? roundQty(n) : 0;
  }
  if (typeof value === "object" && value && "toNumber" in value && typeof (value as { toNumber: unknown }).toNumber === "function") {
    const n = (value as { toNumber: () => number }).toNumber();
    return Number.isFinite(n) ? roundQty(n) : 0;
  }
  const n = Number(value);
  return Number.isFinite(n) ? roundQty(n) : 0;
}

export function parseQtyInput(raw: string): number {
  const s = (raw || "").trim().replace(/\s/g, "");
  if (!s) return NaN;
  const fraction = s.match(/^(\d+)\/(\d+)$/);
  if (fraction) {
    const a = Number(fraction[1]);
    const b = Number(fraction[2]);
    if (!b || !Number.isFinite(a) || !Number.isFinite(b)) return NaN;
    return roundQty(a / b);
  }
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? roundQty(n) : NaN;
}

export function sanitizeQtyInput(raw: string) {
  return raw.replace(/[^\d.,/]/g, "");
}

export function formatQty(value: unknown) {
  const n = toQty(value);
  return n.toLocaleString("id-ID", { maximumFractionDigits: QTY_SCALE });
}

export function lineTotal(qty: unknown, hargaSatuan: number) {
  return Math.round(toQty(qty) * hargaSatuan);
}

export function isValidQty(value: unknown, { allowFraction = true } = {}) {
  const qty = toQty(value);
  if (!Number.isFinite(qty) || qty <= 0 || qty > 999999) return false;
  if (!allowFraction && !Number.isInteger(qty)) return false;
  return true;
}

export function isValidStokCount(value: unknown, { allowFraction = true } = {}) {
  if (value === "" || value == null) return false;
  const qty = typeof value === "number" ? roundQty(value) : toQty(value);
  if (!Number.isFinite(qty) || qty < 0 || qty > 999999) return false;
  if (!allowFraction && !Number.isInteger(qty)) return false;
  return true;
}

export function hasEnoughStock(stok: unknown, need: unknown) {
  return toQty(stok) + 1 / (QTY_FACTOR * 2) >= toQty(need);
}

export function qtyFromTimbang(total: number, hargaPerKg: number) {
  if (!hargaPerKg || hargaPerKg <= 0 || !total || total <= 0) return NaN;
  return roundQty(total / hargaPerKg);
}
