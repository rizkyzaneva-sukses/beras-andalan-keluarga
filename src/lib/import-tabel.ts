import { isProdukTimbang, isValidStokCount, parseQtyInput } from "@/lib/qty";

export type TabelBaris = {
  baris: number;
  nama: string;
  satuan: string;
  jumlah: number;
  hpp: number;
  hargaJual: number;
  error?: string;
};

const SATUAN_ALIAS: Record<string, string> = {
  kg: "kg",
  kilogram: "kg",
  karung: "karung",
  sak: "karung",
  liter: "liter",
  ltr: "liter",
  l: "liter",
  pcs: "pcs",
  pc: "pcs",
  biji: "pcs",
  buah: "pcs",
  butir: "butir",
};

const HEADER_NAMA = ["produk", "nama", "nama produk", "barang"];
const HEADER_SATUAN = ["satuan", "unit"];
const HEADER_JUMLAH = ["jumlah", "stok", "qty", "stok fisik", "fisik"];
const HEADER_HPP = ["hpp", "harga beli", "beli", "modal"];
const HEADER_JUAL = ["harga jual", "jual", "hargajual", "harga"];

function normalizeHeader(raw: string) {
  return raw.trim().toLowerCase().replace(/\s+/g, " ");
}

function detectDelim(text: string) {
  const first = text.split(/\r?\n/).find((line) => line.trim()) || "";
  const tabs = (first.match(/\t/g) || []).length;
  const semis = (first.match(/;/g) || []).length;
  const commas = (first.match(/,/g) || []).length;
  if (tabs >= semis && tabs >= commas && tabs > 0) return "\t";
  if (semis >= commas && semis > 0) return ";";
  return ",";
}

function splitLine(line: string, delim: string) {
  if (delim !== ",") return line.split(delim).map((c) => c.trim().replace(/^"|"$/g, ""));
  const cells: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      quoted = !quoted;
      continue;
    }
    if (ch === "," && !quoted) {
      cells.push(cur.trim());
      cur = "";
      continue;
    }
    cur += ch;
  }
  cells.push(cur.trim());
  return cells;
}

function parseMoney(raw: string) {
  const digits = (raw || "").replace(/[^\d]/g, "");
  if (!digits) return NaN;
  return Number(digits);
}

function colIndex(headers: string[], aliases: string[]) {
  return headers.findIndex((h) => aliases.includes(h));
}

export function parseTabelProduk(text: string): TabelBaris[] {
  const raw = (text || "").replace(/^\uFEFF/, "").trim();
  if (!raw) return [];
  const delim = detectDelim(raw);
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];

  const headerCells = splitLine(lines[0], delim).map(normalizeHeader);
  const hasHeader =
    colIndex(headerCells, HEADER_NAMA) >= 0 &&
    (colIndex(headerCells, HEADER_JUMLAH) >= 0 || colIndex(headerCells, HEADER_JUAL) >= 0);
  const headers = hasHeader ? headerCells : ["produk", "satuan", "jumlah", "hpp", "harga jual"];
  const dataLines = hasHeader ? lines.slice(1) : lines;

  const iNama = colIndex(headers, HEADER_NAMA);
  const iSatuan = colIndex(headers, HEADER_SATUAN);
  const iJumlah = colIndex(headers, HEADER_JUMLAH);
  const iHpp = colIndex(headers, HEADER_HPP);
  const iJual = colIndex(headers, HEADER_JUAL);

  return dataLines.map((line, idx) => {
    const cells = splitLine(line, delim);
    const fallback = (i: number, pos: number) => (i >= 0 ? cells[i] : cells[pos]) || "";
    const nama = fallback(iNama, 0).trim();
    const satuanRaw = fallback(iSatuan, 1).trim().toLowerCase();
    const satuan = SATUAN_ALIAS[satuanRaw] || satuanRaw;
    const jumlah = parseQtyInput(fallback(iJumlah, 2));
    const hpp = parseMoney(fallback(iHpp, 3));
    const hargaJual = parseMoney(fallback(iJual, 4));
    const row: TabelBaris = {
      baris: idx + (hasHeader ? 2 : 1),
      nama,
      satuan,
      jumlah: Number.isFinite(jumlah) ? jumlah : NaN,
      hpp: Number.isFinite(hpp) ? hpp : NaN,
      hargaJual: Number.isFinite(hargaJual) ? hargaJual : NaN,
    };
    if (!nama) row.error = "Nama produk kosong";
    return row;
  });
}

export function validateBarisImport(row: TabelBaris): TabelBaris {
  if (row.error) return row;
  if (!row.satuan) return { ...row, error: "Satuan wajib" };
  if (!isValidStokCount(row.jumlah, { allowFraction: isProdukTimbang(row.nama) })) {
    return { ...row, error: "Jumlah/stok tidak valid" };
  }
  if (!Number.isInteger(row.hpp) || row.hpp <= 0) return { ...row, error: "HPP tidak valid" };
  if (!Number.isInteger(row.hargaJual) || row.hargaJual <= 0) return { ...row, error: "Harga jual tidak valid" };
  return row;
}

export function validateBarisSo(row: TabelBaris): TabelBaris {
  if (row.error) return row;
  if (!isValidStokCount(row.jumlah, { allowFraction: isProdukTimbang(row.nama) })) {
    return { ...row, error: "Stok fisik tidak valid" };
  }
  return row;
}

export const CONTOH_CSV = `PRODUK,SATUAN,JUMLAH,HPP,HARGA JUAL
Beras Pandan Wangi,kg,25,12000,15000
Telur,kg,0.7,28000,30000
`;
