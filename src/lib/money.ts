export function formatRupiah(n: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(n);
}

export function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

export function formatRibuan(digits: string) {
  if (!digits) return "";
  const n = Number(digits);
  if (!Number.isFinite(n)) return "";
  return n.toLocaleString("id-ID");
}

export function parseRibuan(formatted: string) {
  return Number(digitsOnly(formatted)) || 0;
}
