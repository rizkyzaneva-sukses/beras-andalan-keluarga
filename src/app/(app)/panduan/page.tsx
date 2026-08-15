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
  { id: "utang", label: "Utang & Hutang" },
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

      {/* ===== 1. MULAI CEPAT ===== */}
      <div id="panduan-mulai">
        <Card title="1. Mulai Cepat (Alur Harian)">
          <Callout type="ok">
            <strong>Kasir:</strong> Login → POS → scan/pilih produk → bayar → selesai.
            <br />
            <strong>Owner:</strong> Cek Dashboard & Closing di akhir hari. Catat pengeluaran & utang bila ada.
          </Callout>
          <ol className="space-y-3 mt-2">
            <Step n={1}>
              Siapkan produk di menu <Link href="/produk" className="text-primary font-semibold underline">Produk</Link> — pilih tipe: <strong>Karungan</strong> (karung utuh), <strong>Eceran</strong> (per kg dari karung), atau <strong>Gabungan</strong> (resep multi-produk).
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
              Akhir hari buka <Link href="/closing" className="text-primary font-semibold underline">Closing</Link> — cek tunai vs transfer vs QRIS, laba/rugi, dan omset per kasir.
            </Step>
          </ol>
        </Card>
      </div>

      {/* ===== 2. LOGIN ===== */}
      <div id="panduan-login">
        <Card title="2. Login">
          <ul className="space-y-2 text-sm text-muted-foreground list-disc pl-5">
            <li>Buka aplikasi di browser HP (bisa install ke home screen / PWA).</li>
            <li>Masukkan username & password yang dibuat Owner.</li>
            <li>
              <strong className="text-foreground">Owner</strong> diarahkan ke Dashboard (akses semua menu).
            </li>
            <li>
              <strong className="text-foreground">Kasir</strong> diarahkan ke POS (akses POS + Utang Pelanggan + Panduan).
            </li>
          </ul>
          <Callout type="info">
            Default seed: <code className="font-mono text-xs bg-surface px-1.5 py-0.5 rounded">owner / admin123</code> dan{" "}
            <code className="font-mono text-xs bg-surface px-1.5 py-0.5 rounded">kasir / kasir123</code>. Ganti password di production.
          </Callout>
        </Card>
      </div>

      {/* ===== 3. POS KASIR ===== */}
      <div id="panduan-pos">
        <Card title="3. POS Kasir — Jual Beras">
          <p className="text-sm text-muted-foreground">Menu utama kasir. Satu transaksi bisa banyak produk.</p>
          <ol className="space-y-3 mt-1">
            <Step n={1}>
              <strong>Scan Barcode</strong> — tekan tombol, kamera langsung terbuka. Arahkan ke kode produk. Atau tekan{" "}
              <strong>+ Pilih Produk</strong> lalu cari nama.
            </Step>
            <Step n={2}>
              Atur jumlah di keranjang pakai tombol <strong>− / +</strong>. Hapus item dengan tombol ×. Untuk produk tertentu bisa <strong>sesuaikan harga manual</strong> (mis. diskon).
            </Step>
            <Step n={3}>
              Untuk produk <strong>timbang</strong> (telur, beras eceran): pilih <strong>1/4, 1/3, 1/2, 1 kg</strong> atau ketik berat (mis. 0,7). Stok berkurang sesuai kg.
            </Step>
            <Step n={4}>
              Pilih metode bayar: <strong>Tunai</strong>, <strong>QRIS</strong>, <strong>Transfer</strong>, atau <strong>Hutang</strong>.
            </Step>
            <Step n={5}>
              Jika <strong>Tunai</strong>: isi uang diterima → kembalian dihitung otomatis.
            </Step>
            <Step n={6}>
              Jika <strong>Hutang</strong>: ketik nama pelanggan (muncul otomatis jika pelanggan pernah utang), tekan <strong>Catat Hutang</strong>. Nanti bayar di menu Utang.
            </Step>
            <Step n={7}>
              Tekan <strong>BAYAR</strong>. Transaksi tersimpan & stok berkurang otomatis.
            </Step>
          </ol>
          <Callout type="warn">
            Pastikan stok produk cukup. Kalau stok 0, buka karung di Produk (tombol <strong>Buka 1</strong>), isi stok manual, atau lewat Pengeluaran → Restock.
          </Callout>
        </Card>
      </div>

      {/* ===== 4. PRODUK & STOK ===== */}
      <div id="panduan-produk">
        <Card title="4. Master Produk & Stok (Owner)">
          <p className="text-sm text-muted-foreground">
            Ada 3 tipe produk: <strong className="text-blue-600">Karungan</strong>,{" "}
            <strong className="text-green-600">Eceran</strong>, dan{" "}
            <strong className="text-purple-600">Gabungan</strong>.
          </p>

          <div className="space-y-4 mt-3">
            <div>
              <p className="font-semibold text-foreground text-sm mb-1.5">🔵 Karungan — Produk dalam karung/kemasan utuh</p>
              <ul className="space-y-1.5 text-sm text-muted-foreground list-disc pl-5">
                <li>Isi <strong>Isi per Karung</strong> (mis. 25 kg per karung).</li>
                <li>Tombol <strong>Buka 1</strong> — buka 1 karung, stok eceran otomatis bertambah sesuai isi per karung.</li>
                <li>Tombol <strong>Isi</strong> untuk menambah stok karung, <strong>Kurangi</strong> untuk mengurangi (rusak/sampel).</li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-foreground text-sm mb-1.5">🟢 Eceran — Produk dijual per kg/liter/pcs</p>
              <ul className="space-y-1.5 text-sm text-muted-foreground list-disc pl-5">
                <li>Saat tambah, pilih <strong>sumber produk karung</strong> (mis. Beras Premium Eceran ← Beras Premium Karung).</li>
                <li>Stok eceran bertambah otomatis saat karung dibuka (Buka 1).</li>
                <li>Stok bisa dijual langsung lewat POS.</li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-foreground text-sm mb-1.5">🟣 Gabungan — Bundling/resep multi-produk</p>
              <ul className="space-y-1.5 text-sm text-muted-foreground list-disc pl-5">
                <li>Buat resep dari beberapa produk sumber + jumlah per batch.</li>
                <li>Stok gabungan = komponen terkecil ÷ jumlah yang dibutuhkan (hitung otomatis).</li>
                <li>Cocok untuk paket bundling atau campuran khusus.</li>
              </ul>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            <p className="font-semibold text-foreground text-sm">Fitur Tambahan:</p>
            <ul className="space-y-1.5 text-sm text-muted-foreground list-disc pl-5">
              <li><strong>Upload Banyak</strong> — impor produk dari tabel Excel/CSV (kolom: PRODUK, SATUAN, JUMLAH, HPP, HARGA JUAL).</li>
              <li><strong>Stock Opname (SO)</strong> — stok fisik <em>mengganti</em> stok sistem, bukan ditambah. Alasan wajib. Riwayat SO tersimpan.</li>
              <li>Harga jual bisa diedit kapan saja — QR tidak perlu dicetak ulang karena hanya berisi ID produk.</li>
            </ul>
          </div>
        </Card>
      </div>

      {/* ===== 5. CETAK BARCODE ===== */}
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

      {/* ===== 6. PENGELUARAN ===== */}
      <div id="panduan-pengeluaran">
        <Card title="6. Pengeluaran — Restock & Biaya (Owner)">
          <ol className="space-y-3">
            <Step n={1}>
              Buka <Link href="/pembelanjaan" className="text-primary font-semibold underline">Pengeluaran</Link> → + Tambah.
            </Step>
            <Step n={2}>
              Pilih kategori: <strong>Restock Barang</strong>, <strong>Operasional</strong>, atau <strong>Lainnya</strong>.
            </Step>
            <Step n={3}>
              <strong>Restock</strong>: pilih nama produk dari daftar Master Produk (harga beli terisi otomatis). Operasional/Lainnya: ketik nama biaya (muncul autocomplete dari history sebelumnya).
            </Step>
            <Step n={4}>
              Status bayar: <strong>Cash</strong> = langsung potong kas. <strong>Kredit</strong> = tidak potong kas, masuk daftar Utang Toko.
            </Step>
            <Step n={5}>
              Restock: stok produk naik otomatis & HPP rata-rata dihitung ulang.
            </Step>
          </ol>
          <Callout type="info">
            Filter data berdasarkan: <strong>Hari Ini</strong>, <strong>Minggu Ini</strong>, <strong>Bulan Ini</strong>, atau rentang <strong>Custom</strong>.
          </Callout>
        </Card>
      </div>

      {/* ===== 7. UTANG & HUTANG ===== */}
      <div id="panduan-utang">
        <Card title="7. Utang Toko & Hutang Pelanggan">
          <p className="text-sm text-muted-foreground">
            Menu <Link href="/utang" className="text-primary font-semibold underline">Utang & Hutang</Link> — punya 2 tab dan filter status.
          </p>

          <div className="space-y-4 mt-3">
            <div>
              <p className="font-semibold text-foreground text-sm mb-1.5">📋 Hutang Pelanggan (Piutang)</p>
              <ul className="space-y-1.5 text-sm text-muted-foreground list-disc pl-5">
                <li>Pelanggan belanja sekarang, bayar nanti. Catat di POS metode <strong>Hutang</strong> + nama pelanggan.</li>
                <li>Tekan <strong>+ Terima Bayar</strong> untuk catat pembayaran (bisa dicicil, bayar sebagian dulu).</li>
                <li>Pelanggan yang sama bisa punya beberapa hutang sekaligus.</li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-foreground text-sm mb-1.5">📋 Utang Toko (Utang Supplier)</p>
              <ul className="space-y-1.5 text-sm text-muted-foreground list-disc pl-5">
                <li>Belanja ke supplier pakai tempo. Catat di Pengeluaran status <strong>Kredit</strong>.</li>
                <li>Tekan <strong>+ Bayar Cicilan</strong> untuk cicil utang ke supplier.</li>
                <li>Owner only — kasir tidak bisa lihat tab ini.</li>
              </ul>
            </div>
          </div>

          <Callout type="ok">
            <strong>Filter Status:</strong> Semua / Belum Lunas / Lunas. Tab <strong>Belum Lunas</strong> untuk fokus yang belum selesai. Tab <strong>Lunas</strong> untuk cek history yang sudah beres. Tiap item bisa diklik untuk lihat riwayat pembayaran.
          </Callout>
        </Card>
      </div>

      {/* ===== 8. MODAL ===== */}
      <div id="panduan-modal">
        <Card title="8. Modal (Owner)">
          <p className="text-sm text-muted-foreground">
            Catat modal awal & top-up dana di{" "}
            <Link href="/modal" className="text-primary font-semibold underline">
              Modal
            </Link>
            . Total modal dipakai hitung saldo kas di Dashboard dan Closing.
          </p>
        </Card>
      </div>

      {/* ===== 9. DASHBOARD ===== */}
      <div id="panduan-dashboard">
        <Card title="9. Dashboard Laba/Rugi (Owner)">
          <ul className="space-y-2 text-sm text-muted-foreground list-disc pl-5">
            <li>Filter: <strong>Hari Ini</strong> / <strong>Minggu Ini</strong> / <strong>Bulan Ini</strong> / <strong>Custom</strong>.</li>
            <li>
              Ringkasan kartu: <strong className="text-foreground">Pendapatan</strong>,{" "}
              <strong className="text-foreground">Pengeluaran</strong>,{" "}
              <strong className="text-foreground">Laba/Rugi</strong>,{" "}
              <strong className="text-foreground">Modal</strong>,{" "}
              <strong className="text-foreground">Piutang</strong>.
            </li>
            <li>
              Tabel <strong>per hari</strong> — lihat pendapatan, pengeluaran, dan laba rugi harian.
            </li>
            <li>
              <strong>Omset per Kasir</strong> — rekap pendapatan per kasir dengan jumlah transaksi. Klik kasir untuk filter transaksinya saja.
            </li>
            <li>Tab detail penjualan & pengeluaran (paginasi).</li>
            <li>
              Formula cash-basis: <code className="font-mono text-xs">Saldo Kas = Modal + Pendapatan − Pengeluaran</code>.
            </li>
          </ul>
        </Card>
      </div>

      {/* ===== 10. CLOSING ===== */}
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
            <li>Pecahan: <strong>Tunai / Transfer / QRIS / Hutang</strong> — cocokkan dengan uang di laci & rekening</li>
            <li>Piutang belum lunas (peringatan jika ada pelanggan belum bayar)</li>
            <li>Pengeluaran hari ini & laba/rugi</li>
            <li><strong>Omset per Kasir</strong> — rekap jualan per kasir hari ini (total, jumlah transaksi, pecahan metode bayar per kasir)</li>
            <li>Saldo kas kumulatif: Modal + Pendapatan Tunai − Pengeluaran Cash</li>
          </ul>
          <Callout type="ok">
            Uang tunai di laci harus ≈ total <strong>Tunai</strong> di Closing (setelah dikurangi pengeluaran cash hari itu).
          </Callout>
        </Card>
      </div>

      {/* ===== 11. KELOLA USER ===== */}
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
            Setiap jualan di POS tercatat siapa yang input. Closing bisa per kasir. Dashboard ada rekap omset per kasir.
          </Callout>
        </Card>
      </div>

      {/* ===== 12. AUDIT TRAIL ===== */}
      <div id="panduan-audit">
        <Card title="12. Audit Trail (Owner)">
          <p className="text-sm text-muted-foreground">
            Menu{" "}
            <Link href="/audit" className="text-primary font-semibold underline">
              Audit
            </Link>{" "}
            mencatat semua perubahan data: penjualan, pengeluaran, modal, produk, user, utang, piutang, dan stok. Setiap catatan menampilkan: <strong>siapa</strong>, <strong>kapan</strong>, <strong>aksi</strong> (catat/ubah/hapus), dan <strong>data sebelum/sesudah</strong>. Berguna untuk deteksi kebocoran, kesalahan input, atau jejak perubahan harga.
          </p>
        </Card>
      </div>

      {/* ===== 13. TIPS & FAQ ===== */}
      <div id="panduan-tips">
        <Card title="13. Tips & FAQ">
          <div className="space-y-4 text-sm">
            <div>
              <p className="font-semibold text-foreground">Buka karung 1 sak = stok eceran bertambah?</p>
              <p className="text-muted-foreground mt-1">
                Ya! Di menu <strong>Produk</strong>, cari produk bertipe Karungan → tekan tombol <strong>Buka 1</strong>. Konfirmasi → stok eceran otomatis +25kg (atau sesuai isi per karung). Tidak perlu Pindah manual lagi.
              </p>
            </div>
            <div>
              <p className="font-semibold text-foreground">Kenapa barcode tidak scan / malah buka gambar?</p>
              <p className="text-muted-foreground mt-1">
                Tekan <strong>Scan Barcode</strong> — kamera langsung terbuka, tidak perlu pilih file. Izinkan kamera di browser. Pencahayaan cukup. Atau pakai + Pilih Produk.
              </p>
            </div>
            <div>
              <p className="font-semibold text-foreground">Telur / beras eceran dijual per kg?</p>
              <p className="text-muted-foreground mt-1">
                Di POS pilih <strong>1/4, 1/3, 1/2, 1 kg</strong> atau ketik berat (mis. 0,7 kg). Stok berkurang sesuai kg. Pastikan produk bertipe Eceran dan sumbernya sudah di-set.
              </p>
            </div>
            <div>
              <p className="font-semibold text-foreground">Produk tidak muncul di restock?</p>
              <p className="text-muted-foreground mt-1">
                Pastikan produk sudah terdaftar di menu Produk. Saat Pengeluaran → Restock, pilih nama dari dropdown Master Produk (bukan ketik bebas).
              </p>
            </div>
            <div>
              <p className="font-semibold text-foreground">Beda Karungan, Eceran, dan Gabungan?</p>
              <p className="text-muted-foreground mt-1">
                <strong>Karungan</strong> = stok dalam satuan karung (mis. 10 karung). <strong>Eceran</strong> = stok dalam kg/pcs, sumbernya dari karung (buka 1 karung → +25kg eceran). <strong>Gabungan</strong> = resep bundling dari beberapa produk sumber, stok dihitung dari komponen terbatas.
              </p>
            </div>
            <div>
              <p className="font-semibold text-foreground">Pelanggan bayar hutang sebagian?</p>
              <p className="text-muted-foreground mt-1">
                Bisa dicicil. Di menu Utang tab Pelanggan, tekan <strong>+ Terima Bayar</strong>, masukkan jumlah. Lunas otomatis saat sisa = 0. Filter <strong>Belum Lunas</strong> untuk fokus yang belum selesai. Klik item untuk lihat semua riwayat bayar.
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
                Pengeluaran → status <strong>Kredit</strong>. Nanti bayar cicilan di menu Utang tab Toko. Filter <strong>Belum Lunas</strong> untuk lihat yang belum dibayar.
              </p>
            </div>
            <div>
              <p className="font-semibold text-foreground">HP vs desktop?</p>
              <p className="text-muted-foreground mt-1">
                HP: menu bawah + sheet &quot;Lainnya&quot;. Tablet/desktop: sidebar kiri. POS di layar lebar: keranjang kiri, bayar kanan.
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
