export type UserRole = "OWNER" | "KASIR";
export type MetodeBayar = "CASH" | "TRANSFER" | "QRIS" | "HUTANG";
export type KategoriPembelanjaan = "RESTOCK" | "OPERASIONAL" | "LAINNYA";

export interface Product {
  id: string;
  nama: string;
  satuan: string;
  hargaBeli: number;
  hargaJual: number;
  stok: number;
  hppRataRata: number;
  aktif: boolean;
}

export interface ModalEntry {
  id: string;
  jumlah: number;
  tanggal: string;
  keterangan: string | null;
  createdBy: string;
}

export interface PembelanjaanEntry {
  id: string;
  tanggal: string;
  kategori: KategoriPembelanjaan;
  namaBarang: string;
  jumlah: number;
  harga: number;
  total: number;
  statusBayar: "CASH" | "KREDIT";
  produkId?: string | null;
  createdBy: string;
}

export interface PenjualanEntry {
  id: string;
  tanggal: string;
  produkId: string;
  produkNama?: string;
  qty: number;
  hargaJual: number;
  total: number;
  metodeBayar: MetodeBayar;
  hargaDisesuaikan: boolean;
  namaPelanggan?: string | null;
  piutangId?: string | null;
  createdBy: string;
  createdByUsername?: string;
}

export interface PiutangItem {
  id: string;
  namaPelanggan: string;
  tanggal: string;
  total: number;
  sudahDibayar: number;
  keterangan: string | null;
}

export interface OmsetPerUser {
  userId: string;
  username: string;
  role: "OWNER" | "KASIR";
  isActive: boolean;
  cashTotal: number;
  transferTotal: number;
  qrisTotal: number;
  hutangTotal: number;
  total: number;
  transaksi: number;
  qty: number;
}

export interface LaporanSummary {
  totalPendapatan: number;
  totalPengeluaran: number;
  labaRugi: number;
  totalModal: number;
  saldoKas: number;
  totalPiutang: number;
}
