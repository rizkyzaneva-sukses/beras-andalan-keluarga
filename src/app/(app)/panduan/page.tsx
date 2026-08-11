"use client";

import { useState } from "react";
import Link from "next/link";

type SectionId =
  | "mulai"
  | "login"
  | "pos"
  | "produk"
  | "barcode"
  | "pengeluaran"
  | "utang"
  | "modal"
  | "dashboard"
  | "closing"
  | "user"
  | "audit"
  | "tips";

const SECTIONS: { id: SectionId; label: string; ownerOnly?: boolean }[] = [
  { id: "mulai", label: "Mulai Cepat" },
  { id: "login", label: "Login" },
  { id: "pos", label: "POS Kasir" },
  { id: "produk", label: "Produk & Stok", ownerOnly: true },
  { id: "barcode", label: "Cetak Barcode", ownerOnly: true },
  { id: "pengeluaran", label: "Pengeluaran", ownerOnly: true },
  { id: "utang", label: "Utang Vendor", ownerOnly: true },
  { id: "modal", label: "Modal", ownerOnly: true },
  { id: "dashboard", label: "Dashboard", ownerOnly: true },
  { id: "closing", label: "Closing Harian", ownerOnly: true },
  { id: "user", label: "Kelola User", ownerOnly: true },
  { id: "audit", label: "Audit Trail", ownerOnly: true },
  { id: "tips", label: "Tips & FAQ" },
];

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="shrink-0 w-7 h-7 rounded-full bg-primary-soft text-primary text-sm font-bold flex items-center justify-center">
        {n}
      </span>
      <span className="text-sm leading-relaxed pt-0.5">{children}</span>
    </li>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card-surface p-4 sm:p-5 space-y-3">
      <h3 className="text-base sm:text-lg font-bold tracking-tight">{title}</h3>
      {children}
    </section>
  );
}

function Callout({
  type = "info",
  children,
}: {
  type?: "info" | "warn" | "ok";
  children: React.ReactNode;
}) {
  const styles =
    type === "warn"
      ? "bg-warning-soft border-warning/25 text-foreground"
      : type === "ok"
        ? "bg-primary-soft border-primary/20 text-foreground"
        : "bg-muted border-border text-foreground";
  return (
    <div className={`rounded-xl border px-3.5 py-3 text-sm leading-relaxed ${styles}`}>{children}</div>
  );
}

export default function PanduanPage() {
  const [open, setOpen] = useState<SectionId | "all">("mulai");

  function scrollTo(id: SectionId) {
    setOpen(id);
    const el = document.getElementById(`panduan-${id}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="page-wrap space-y-4 pb-8">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Panduan Operasional</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Cara pakai aplikasi Beras Andalan Keluarga — untuk Owner & Kasir
        </p>
      </div>

      <div className="flex gap-1.5 overflow-x-auto scrollbar-none pb-1 -mx-1 px-1">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            onClick={() => scrollTo(s.id)}
            className={`shrink-0 px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
              open === s.id
                ? "bg-primary text-white shadow-sm"
                : "bg-surface border border-border text-muted-foreground hover:bg-muted"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div id="panduan-mulai">
        <Card title="1. Mulai Cepat (Alur Harian)">
          <Callout type="ok">
            <strong>Kasir:</strong> Login → POS → scan/pilih produk → bayar → selesai.
            <br />
            <strong>Owner:</strong> Cek Dashboard & Closing di akhir hari. Catat pengeluaran & utang bila ada.
          </Callout>
          <ol className="space-y-3 mt-2">
            <Step n={1}>
              Siapkan produk di menu <Link href="/produk" className="text-primary font-semibold underline">Produk</Link> (nama, harga beli, harga jual, stok).
            </Step>
            <Step n={2}>
              Cetak QR di menu <Link href="/barcode" className="text-primary font-semibold underline">Barcode</Link>, potong, tempel ke karung/etalase.
            </Step>
            <Step n={3}>
              Buat akun kasir di menu <Link href="/users" className="text-primary font-semibold underline">User</Link> (opsional, multi-kasir).
            </Step>
            <Step n={4}>
              Transaksi jualan lewat <Link href="/pos" className="text-primary font-semibold underline">POS Kasir</Link>.
            </Step>
            <Step n={5}>
              Akhir hari buka <Link href="/closing" className="text-primary font-semibold underline">Closing</Link> — cek tunai vs transfer vs QRIS.
            </Step>
          </ol>
        </Card>
      </div>

      <div id="panduan-login">
        <Card title="2. Login">
          <ul className="space-y-2 text-sm text-muted-foreground list-disc pl-5">
            <li>Buka aplikasi di browser HP (bisa install ke home screen / PWA).</li>
            <li>Masukkan username & password yang dibuat Owner.</li>
            <li>
              <strong className="text-foreground">Owner</strong> diarahkan ke Dashboard (akses semua menu).
            </li>
            <li>
              <strong className="text-foreground">Kasir</strong> diarahkan ke POS (hanya transaksi jualan).
            </li>
          </ul>
          <Callout type="info">
            Default seed: <code className="font-mono text-xs bg-surface px-1.5 py-0.5 rounded">owner / admin123</code> dan{" "}
            <code className="font-mono text-xs bg-surface px-1.5 py-0.5 rounded">kasir / kasir123</code>. Ganti password di production.
          </Callout>
        </Card>
      </div>

      <div id="panduan-pos">
        <Card title="3. POS Kasir — Jual Beras">
          <p className="text-sm text-muted-foreground">Menu utama kasir. Satu transaksi bisa banyak produk.</p>
          <ol className="space-y-3 mt-1">
            <Step n={1}>
              <strong>Scan QR / Barcode</strong> — tekan tombol scan, arahkan kamera ke kode produk. Atau tekan{" "}
              <strong>+ Pilih Produk</strong> lalu cari nama.
            </Step>
            <Step n={2}>
              Atur jumlah di keranjang pakai tombol <strong>− / +</strong>. Hapus item dengan tombol ×.
            </Step>
            <Step n={3}>
              Pilih metode bayar: <strong>Tunai</strong>, <strong>QRIS</strong>, atau <strong>Transfer</strong>.
            </Step>
            <Step n={4}>
              Jika <strong>Tunai</strong>: isi uang diterima → kembalian dihitung otomatis.
            </Step>
            <Step n={5}>
              Tekan <strong>BAYAR</strong>. Transaksi tersimpan & stok berkurang otomatis.
            </Step>
          </ol>
          <Callout type="warn">
            Pastikan stok produk cukup. Kalau stok 0, restock dulu lewat menu Pengeluaran (kategori Restock).
          </Callout>
        </Card>
      </div>

      <div id="panduan-produk">
        <Card title="4. Master Produk & Stok (Owner)">
          <ol className="space-y-3">
            <Step n={1}>
              Buka <Link href="/produk" className="text-primary font-semibold underline">Produk</Link> → + Tambah.
            </Step>
            <Step n={2}>Isi nama, satuan (kg/karung/liter), harga beli, harga jual.</Step>
            <Step n={3}>
              <strong>Stok</strong> bertambah saat restock (Pengeluaran → Restock), berkurang saat jualan di POS.
            </Step>
            <Step n={4}>
              Harga jual boleh diedit kapan saja (misal harga pasar naik) — tidak perlu cetak ulang QR, karena QR hanya berisi ID produk.
            </Step>
          </ol>
        </Card>
      </div>

      <div id="panduan-barcode">
        <Card title="5. Cetak Barcode / QR (Owner)">
          <ol className="space-y-3">
            <Step n={1}>
              Buka <Link href="/barcode" className="text-primary font-semibold underline">Barcode</Link>.
            </Step>
            <Step n={2}>Pilih format: <strong>QR Code</strong> (disarankan, lebih kecil) atau CODE128.</Step>
            <Step n={3}>
              Tekan <strong>Cetak</strong> — layout F4, 3 kolom, margin sempit, garis putus-putus untuk digunting.
            </Step>
            <Step n={4}>Tempel ke kemasan. Scan di POS = produk masuk keranjang.</Step>
          </ol>
          <Callout type="info">Nama produk tercetak di atas kode. Harga tidak dicetak agar tidak usang saat harga berubah.</Callout>
        </Card>
      </div>

      <div id="panduan-pengeluaran">
        <Card title="6. Pengeluaran — Restock & Biaya (Owner)">
          <ol className="space-y-3">
            <Step n={1}>
              Buka <Link href="/pembelanjaan" className="text-primary font-semibold underline">Pengeluaran</Link> → + Tambah.
            </Step>
            <Step n={2}>
              Pilih kategori: <strong>Restock Beras</strong>, <strong>Operasional</strong>, atau <strong>Lainnya</strong>.
            </Step>
            <Step n={3}>
              Nama barang: ketik untuk search history (misal “angkut”) atau isi nama baru.
            </Step>
            <Step n={4}>
              Status bayar: <strong>Cash</strong> = langsung potong kas. <strong>Kredit</strong> = tidak potong kas, masuk daftar Utang.
            </Step>
            <Step n={5}>
              Restock: stok produk naik (jika nama barang cocok dengan nama produk) & HPP rata-rata dihitung ulang.
            </Step>
          </ol>
        </Card>
      </div>

      <div id="panduan-utang">
        <Card title="7. Utang Vendor (Owner)">
          <ol className="space-y-3">
            <Step n={1}>
              Pengeluaran yang statusnya <strong>Kredit</strong> muncul di{" "}
              <Link href="/utang" className="text-primary font-semibold underline">Utang</Link>.
            </Step>
            <Step n={2}>Lihat sisa tagihan & progress bayar.</Step>
            <Step n={3}>
              Tekan <strong>+ Bayar Utang</strong> → isi jumlah → <strong>Bayar</strong>. Saldo kas berkurang.
            </Step>
            <Step n={4}>Bisa cicil; utang hilang dari daftar setelah lunas penuh.</Step>
          </ol>
        </Card>
      </div>

      <div id="panduan-modal">
        <Card title="8. Modal (Owner)">
          <p className="text-sm text-muted-foreground">
            Catat modal awal & top-up dana di{" "}
            <Link href="/modal" className="text-primary font-semibold underline">
              Modal
            </Link>
            . Total modal dipakai hitung saldo kas di Dashboard.
          </p>
        </Card>
      </div>

      <div id="panduan-dashboard">
        <Card title="9. Dashboard Laba/Rugi (Owner)">
          <ul className="space-y-2 text-sm text-muted-foreground list-disc pl-5">
            <li>Filter: Hari Ini / Minggu Ini / Bulan Ini / Custom.</li>
            <li>
              Ringkasan: <strong className="text-foreground">Pendapatan</strong>,{" "}
              <strong className="text-foreground">Pengeluaran</strong>,{" "}
              <strong className="text-foreground">Laba/Rugi</strong>,{" "}
              <strong className="text-foreground">Saldo Kas</strong>.
            </li>
            <li>
              Formula cash-basis: <code className="font-mono text-xs">Pendapatan − Pengeluaran</code>.
            </li>
            <li>Tab detail penjualan & pengeluaran + tabel laba per hari.</li>
            <li>
              Tombol testing: Buat Data Dummy / Reset Semua Data (hati-hati di production).
            </li>
          </ul>
        </Card>
      </div>

      <div id="panduan-closing">
        <Card title="10. Closing Harian (Owner)">
          <p className="text-sm text-muted-foreground mb-2">
            Satu layar ringkas untuk tutup toko di{" "}
            <Link href="/closing" className="text-primary font-semibold underline">
              Closing
            </Link>
            :
          </p>
          <ul className="space-y-1.5 text-sm text-muted-foreground list-disc pl-5">
            <li>Total pendapatan hari ini</li>
            <li>Pecahan: Tunai / Transfer / QRIS — cocokkan dengan uang di laci & rekening</li>
            <li>Pengeluaran hari ini & laba/rugi</li>
            <li>Saldo kas kumulatif</li>
          </ul>
          <Callout type="ok">
            Uang tunai di laci harus ≈ total <strong>Tunai</strong> di Closing (setelah dikurangi pengeluaran cash hari itu).
          </Callout>
        </Card>
      </div>

      <div id="panduan-user">
        <Card title="11. Kelola User Multi-Kasir (Owner)">
          <ol className="space-y-3">
            <Step n={1}>
              Buka <Link href="/users" className="text-primary font-semibold underline">User</Link> → + Tambah.
            </Step>
            <Step n={2}>Isi username, password, role (Kasir / Owner).</Step>
            <Step n={3}>Nonaktifkan akun yang tidak dipakai (bukan hapus) bila masih ada history transaksi.</Step>
            <Step n={4}>Akun <code className="font-mono text-xs">owner</code> utama tidak bisa dihapus.</Step>
          </ol>
          <Callout type="info">
            Setiap jualan di POS tercatat siapa yang input. Nanti rekap closing bisa per kasir (kasir A / B / Owner).
          </Callout>
        </Card>
      </div>

      <div id="panduan-audit">
        <Card title="12. Audit Trail (Owner)">
          <p className="text-sm text-muted-foreground">
            Menu{" "}
            <Link href="/audit" className="text-primary font-semibold underline">
              Audit
            </Link>{" "}
            mencatat edit & hapus transaksi (siapa, kapan, data sebelum/sesudah). Buka baris untuk lihat detail. Berguna deteksi kebocoran atau kesalahan input.
          </p>
        </Card>
      </div>

      <div id="panduan-tips">
        <Card title="13. Tips & FAQ">
          <div className="space-y-4 text-sm">
            <div>
              <p className="font-semibold text-foreground">Kenapa QR tidak scan?</p>
              <p className="text-muted-foreground mt-1">
                Izinkan kamera di browser. Pastikan pencahayaan cukup. Atau pakai + Pilih Produk manual.
              </p>
            </div>
            <div>
              <p className="font-semibold text-foreground">Harga naik, stok masih ada?</p>
              <p className="text-muted-foreground mt-1">
                Edit harga jual di Produk. QR tidak perlu dicetak ulang. Transaksi lama tetap pakai harga saat itu.
              </p>
            </div>
            <div>
              <p className="font-semibold text-foreground">Belanja ke supplier pakai tempo?</p>
              <p className="text-muted-foreground mt-1">
                Pengeluaran → status <strong>Kredit</strong>. Nanti bayar cicilan di menu Utang.
              </p>
            </div>
            <div>
              <p className="font-semibold text-foreground">HP vs desktop?</p>
              <p className="text-muted-foreground mt-1">
                HP: menu bawah + sheet “Lainnya”. Tablet/desktop: sidebar kiri. POS di layar lebar: keranjang kiri, bayar kanan.
              </p>
            </div>
            <div>
              <p className="font-semibold text-foreground">Butuh bantuan teknis?</p>
              <p className="text-muted-foreground mt-1">
                Repo:{" "}
                <a
                  href="https://github.com/rizkyzaneva-sukses/beras-andalan-keluarga"
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary font-medium underline"
                >
                  beras-andalan-keluarga
                </a>
              </p>
            </div>
          </div>
        </Card>
      </div>

      <div className="card-surface p-4 text-center">
        <p className="text-sm font-semibold">Siap jualan?</p>
        <div className="flex flex-col sm:flex-row gap-2 mt-3 justify-center">
          <Link href="/pos" className="btn-primary px-5 py-3 text-sm text-center">
            Buka POS
          </Link>
          <Link
            href="/dashboard"
            className="px-5 py-3 text-sm font-semibold rounded-xl border border-border bg-surface hover:bg-muted text-center"
          >
            Ke Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
