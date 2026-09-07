export const WIB_TZ = "Asia/Jakarta";

/** Tanggal kalender hari ini di WIB, format YYYY-MM-DD. */
export function todayWib(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: WIB_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Ubah Date/ISO ke tanggal kalender WIB (YYYY-MM-DD). */
export function toWibDateString(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: WIB_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** Simpan tanggal kalender (YYYY-MM-DD) sebagai UTC midnight — sama seperti input type=date. */
export function wibCalendarUtc(dateStr: string): Date {
  return new Date(`${dateStr.slice(0, 10)}T00:00:00.000Z`);
}

export function startOfWeekMondayWib(ymd = todayWib()): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d));
  const day = utc.getUTCDay();
  const diff = day === 0 ? 6 : day - 1;
  utc.setUTCDate(utc.getUTCDate() - diff);
  return utc.toISOString().slice(0, 10);
}

export function startOfMonthWib(ymd = todayWib()): string {
  return `${ymd.slice(0, 7)}-01`;
}
