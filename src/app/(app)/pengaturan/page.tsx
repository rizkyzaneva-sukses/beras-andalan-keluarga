"use client";

import { useEffect, useState, useRef } from "react";
import { formatRupiah } from "@/lib/money";

interface SettingsData {
  namaToko: string;
  slogan: string;
  logoText: string;
  logoColor: string;
  logoUrl: string;
  alamat: string;
  telepon: string;
}

const COLOR_PRESETS = [
  { label: "Hijau Emerald", value: "#15803d" },
  { label: "Biru Navy", value: "#1d4ed8" },
  { label: "Ungu Royal", value: "#7e22ce" },
  { label: "Merah Maroon", value: "#b91c1c" },
  { label: "Amber Gold", value: "#d97706" },
  { label: "Slate Dark", value: "#334155" },
  { label: "Teal Cyan", value: "#0f766e" },
];

const SOLVED_PROBLEMS = [
  {
    id: "desimal",
    icon: "⚖️",
    badge: "Akurasi Stok & POS",
    title: "Timbangan Telur & Beras Eceran (Pecahan Desimal)",
    problem:
      "Penjualan telur 1/4 kg (0.25 kg), 1/2 kg (0.5 kg), atau beras 1.5 kg sering salah hitung dan membuat stok gudang minus jika sistem hanya mendukung angka bulat.",
    solution:
      "Mendukung angka desimal 3 digit (0.001 kg), tombol preset instan (1/4, 1/3, 1/2, 1 kg), input harga langsung hasil timbangan, dan pencegahan stok minus secara otomatis.",
  },
  {
    id: "buka-karung",
    icon: "📦",
    badge: "Manajemen Karung",
    title: "Konversi Beras Karung ke Eceran (Buka Karung)",
    problem:
      "Toko membeli beras dalam bentuk karung 25kg/50kg dari supplier, lalu dibuka untuk dijual eceran per kilogram. Stok karung dan eceran sering tidak sinkron.",
    solution:
      "Fitur 'Buka Karung' dalam 1 klik otomatis memotong 1 karung dari stok karung dan menambahkan 25kg atau 50kg ke stok eceran dengan pencatatan audit log lengkap.",
  },
  {
    id: "komposisi",
    icon: "🥣",
    badge: "Oplosan & Repacking",
    title: "Beras Campuran / Oplosan (Komposisi Resep)",
    problem:
      "Beras racikan (misal: 50% Ramos + 50% Pandan Wangi) sulit dikurangi stok bahan mentahnya secara manual tiap kali ada pembelian di kasir.",
    solution:
      "Sistem resep komposisi otomatis memotong stok masing-masing bahan mentah sumber secara proporsional setiap kali beras racikan terjual di POS.",
  },
  {
    id: "kasir-closing",
    icon: "💰",
    badge: "Kasir & Keuangan",
    title: "Selisih Uang Kasir & Multi-Metode Pembayaran",
    problem:
      "Transaksi uang tunai bercampur dengan QRIS, Transfer Bank, dan Hutang, sehingga uang fisik di laci kasir sering tidak cocok dengan catatan saat tutup toko.",
    solution:
      "POS kasir mencatat metode bayar secara presisi, menghitung uang kembalian otomatis, dan modul Closing Harian memisahkan rekap omset per kasir secara transparan.",
  },
  {
    id: "piutang",
    icon: "📒",
    badge: "Hutang Pelanggan",
    title: "Catatan Hutang Pelanggan Hilang / Lupa Tertagih",
    problem:
      "Hutang tetangga atau pelanggan langganan hanya dicatat di buku sobekan kertas yang rawan hilang, rusak, atau lupa ditagih.",
    solution:
      "Pencatatan hutang langsung terintegrasi dari tombol kasir POS, lengkap dengan riwayat pembayaran cicilan/lunas, sisa saldo hutang, dan filter pelanggan belum lunas.",
  },
  {
    id: "so-audit",
    icon: "🔍",
    badge: "Stock Opname",
    title: "Selisih Stok Fisik vs Catatan (Stock Opname / SO)",
    problem:
      "Penyusutan beras, karung tercecer, atau telur pecah membuat stok di komputer berbeda dengan barang fisik di toko tanpa tahu penyebabnya.",
    solution:
      "Fitur Stock Opname (SO) berkala menghitung selisih fisik vs sistem dan mewajibkan catatan alasan (susut, rusak, bonus, salah hitung) untuk riwayat audit.",
  },
  {
    id: "barcode",
    icon: "🏷️",
    badge: "Cepat & Modern",
    title: "Label Barcode & QR Code Siap Cetak",
    problem:
      "Kasir pemula lambat mencari nama beras di daftar ratusan produk atau salah memasukkan harga jual.",
    solution:
      "Modul cetak label QR Code dan Barcode CODE128 siap diprint dan ditempel di etalase/karung. Kasir cukup scan menggunakan kamera HP tanpa alat scanner mahal.",
  },
  {
    id: "laba-keamanan",
    icon: "🛡️",
    badge: "Keamanan & Laba Bersih",
    title: "Laba Bersih Nyata & Keamanan Akses Karyawan",
    problem:
      "Pengeluaran belanja modal tercampur dengan biaya operasional sehingga laba/rugi toko tidak akurat, serta rawan manipulasi data jika kasir memiliki akses bebas.",
    solution:
      "Perhitungan Cash-Basis akurat dengan HPP rata-rata berjalan, pemisahan role Pemilik (Owner) vs Kasir, proteksi sesi ketat, dan Audit Trail aktivitas.",
  },
];

export default function PengaturanPage() {
  const [tab, setTab] = useState<"identitas" | "reset" | "history">("identitas");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const [form, setForm] = useState<SettingsData>({
    namaToko: "Beras Andalan",
    slogan: "Toko beras keluarga",
    logoText: "B",
    logoColor: "#15803d",
    logoUrl: "",
    alamat: "",
    telepon: "",
  });

  const [logoMode, setLogoMode] = useState<"text" | "image">("text");

  // Reset state
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resetMode, setResetMode] = useState<"transaksi" | "total">("transaksi");
  const [resetConfirmText, setResetConfirmText] = useState("");
  const [resetting, setResetting] = useState(false);
  const [resetMessage, setResetMessage] = useState("");

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    fetch("/api/pengaturan")
      .then((r) => r.json())
      .then((json) => {
        if (json.data) {
          setForm({
            namaToko: json.data.namaToko || "Beras Andalan",
            slogan: json.data.slogan || "Toko beras keluarga",
            logoText: json.data.logoText || "B",
            logoColor: json.data.logoColor || "#15803d",
            logoUrl: json.data.logoUrl || "",
            alamat: json.data.alamat || "",
            telepon: json.data.telepon || "",
          });
          if (json.data.logoUrl) {
            setLogoMode("image");
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 1.5 * 1024 * 1024) {
      alert("Ukuran gambar maksimal 1.5 MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setForm((prev) => ({ ...prev, logoUrl: reader.result as string }));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg("");
    setSaveSuccess(false);

    try {
      const res = await fetch("/api/pengaturan", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          logoUrl: logoMode === "image" ? form.logoUrl : "",
        }),
      });
      const json = await res.json();
      if (res.ok) {
        setSaveSuccess(true);
        // Refresh page layout after 1s so sidebar & header update immediately
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      } else {
        setErrorMsg(json.error || "Gagal menyimpan pengaturan");
      }
    } catch {
      setErrorMsg("Terjadi kesalahan saat menghubungi server");
    } finally {
      setSaving(false);
    }
  };

  const handleExecuteReset = async () => {
    if (resetConfirmText.trim().toUpperCase() !== "RESET") {
      alert("Ketik kata 'RESET' dengan benar untuk konfirmasi.");
      return;
    }

    setResetting(true);
    try {
      const res = await fetch("/api/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: resetMode }),
      });
      const json = await res.json();
      if (res.ok) {
        setResetMessage(json.message);
        setResetModalOpen(false);
        setResetConfirmText("");
        alert(json.message);
        window.location.href = "/dashboard";
      } else {
        alert("Gagal reset: " + (json.error || "Terjadi kesalahan"));
      }
    } catch {
      alert("Gagal menghubungi server untuk reset data.");
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="page-wrap space-y-5 pb-12">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Pengaturan Toko & Sistem</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Kelola nama toko, logo, reset data transaksi, dan riwayat penyelesaian masalah
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border gap-1 overflow-x-auto scrollbar-none pb-0.5">
        <button
          type="button"
          onClick={() => setTab("identitas")}
          className={`px-4 py-2.5 text-sm font-semibold whitespace-nowrap transition-colors border-b-2 -mb-px ${
            tab === "identitas"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          🏪 Identitas & Logo Toko
        </button>
        <button
          type="button"
          onClick={() => setTab("reset")}
          className={`px-4 py-2.5 text-sm font-semibold whitespace-nowrap transition-colors border-b-2 -mb-px ${
            tab === "reset"
              ? "border-danger text-danger"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          ⚠️ Reset Data (Mulai 0)
        </button>
        <button
          type="button"
          onClick={() => setTab("history")}
          className={`px-4 py-2.5 text-sm font-semibold whitespace-nowrap transition-colors border-b-2 -mb-px ${
            tab === "history"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          📜 Riwayat Masalah Selesai
        </button>
      </div>

      {/* TAB 1: IDENTITAS & LOGO */}
      {tab === "identitas" && (
        <div className="space-y-5">
          {saveSuccess && (
            <div className="rounded-xl bg-primary-soft border border-primary/20 text-primary px-4 py-3 text-sm font-semibold flex items-center gap-2">
              <span>✓</span> Pengaturan berhasil disimpan! Memperbarui tampilan toko...
            </div>
          )}

          {errorMsg && (
            <div className="rounded-xl bg-danger-soft border border-danger/20 text-danger px-4 py-3 text-sm font-semibold">
              {errorMsg}
            </div>
          )}

          {/* Live Preview Card */}
          <div className="card-surface p-4 sm:p-5 bg-gradient-to-br from-surface to-muted/40 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
                Live Preview Header & Sidebar
              </span>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                Tampilan Real-time
              </span>
            </div>

            <div className="rounded-xl border border-border bg-surface p-4 shadow-sm flex items-center gap-3.5">
              {logoMode === "image" && form.logoUrl ? (
                <img
                  src={form.logoUrl}
                  alt={form.namaToko}
                  className="w-12 h-12 rounded-xl object-cover border border-border shrink-0 shadow-sm"
                />
              ) : (
                <div
                  className="w-12 h-12 rounded-xl text-white flex items-center justify-center font-bold text-xl shrink-0 shadow-sm transition-colors"
                  style={{ backgroundColor: form.logoColor || "#15803d" }}
                >
                  {form.logoText || (form.namaToko ? form.namaToko.slice(0, 1).toUpperCase() : "B")}
                </div>
              )}

              <div className="min-w-0 flex-1">
                <h3 className="font-bold text-base text-foreground leading-tight truncate">
                  {form.namaToko || "Nama Toko"}
                </h3>
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  {form.slogan || "Slogan Toko"}
                </p>
                {form.alamat && (
                  <p className="text-[11px] text-muted-foreground/80 truncate mt-0.5">
                    📍 {form.alamat} {form.telepon ? `· 📞 ${form.telepon}` : ""}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSaveSettings} className="card-surface p-4 sm:p-6 space-y-4">
            <h2 className="text-base font-bold text-foreground">Detail Informasi Toko</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-sm font-semibold mb-1.5">
                  Nama Toko <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  value={form.namaToko}
                  onChange={(e) => {
                    const nama = e.target.value;
                    setForm((prev) => ({
                      ...prev,
                      namaToko: nama,
                      logoText: prev.logoText || (nama ? nama.slice(0, 1).toUpperCase() : "B"),
                    }));
                  }}
                  required
                  placeholder="Contoh: Toko Beras Berkah Jaya"
                  className="input-field text-base font-medium"
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Nama toko akan tampil di judul aplikasi, sidebar, header kasir, dan struk cetak.
                </p>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-sm font-semibold mb-1.5">Slogan / Keterangan</label>
                <input
                  type="text"
                  value={form.slogan}
                  onChange={(e) => setForm((prev) => ({ ...prev, slogan: e.target.value }))}
                  placeholder="Contoh: Toko beras keluarga & sembako berkualitas"
                  className="input-field text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1.5">Alamat Toko (Opsional)</label>
                <input
                  type="text"
                  value={form.alamat}
                  onChange={(e) => setForm((prev) => ({ ...prev, alamat: e.target.value }))}
                  placeholder="Contoh: Jl. Pasar Induk No. 12"
                  className="input-field text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1.5">No. Telepon / WhatsApp (Opsional)</label>
                <input
                  type="text"
                  value={form.telepon}
                  onChange={(e) => setForm((prev) => ({ ...prev, telepon: e.target.value }))}
                  placeholder="Contoh: 0812-3456-7890"
                  className="input-field text-sm font-mono"
                />
              </div>
            </div>

            <hr className="border-border my-2" />

            {/* Logo Settings */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-bold text-foreground">Desain & Gaya Logo</label>
                <div className="flex bg-muted rounded-lg p-0.5 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setLogoMode("text")}
                    className={`px-3 py-1 rounded-md transition-colors ${
                      logoMode === "text" ? "bg-surface text-primary shadow-sm" : "text-muted-foreground"
                    }`}
                  >
                    Inisial Teks
                  </button>
                  <button
                    type="button"
                    onClick={() => setLogoMode("image")}
                    className={`px-3 py-1 rounded-md transition-colors ${
                      logoMode === "image" ? "bg-surface text-primary shadow-sm" : "text-muted-foreground"
                    }`}
                  >
                    Upload Gambar
                  </button>
                </div>
              </div>

              {logoMode === "text" ? (
                <div className="space-y-3 bg-muted/40 p-3.5 rounded-xl border border-border">
                  <div>
                    <label className="block text-xs font-semibold mb-1">Inisial / Huruf Logo (1-3 Karakter)</label>
                    <input
                      type="text"
                      maxLength={4}
                      value={form.logoText}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, logoText: e.target.value.toUpperCase() }))
                      }
                      placeholder="Contoh: BA / B / TB"
                      className="input-field w-32 text-center text-lg font-bold uppercase tracking-wider"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold mb-1.5">Pilihan Warna Tema Logo</label>
                    <div className="flex flex-wrap items-center gap-2">
                      {COLOR_PRESETS.map((color) => (
                        <button
                          key={color.value}
                          type="button"
                          onClick={() => setForm((prev) => ({ ...prev, logoColor: color.value }))}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                            form.logoColor === color.value
                              ? "border-foreground ring-2 ring-primary/40 bg-surface text-foreground shadow-sm"
                              : "border-border bg-surface text-muted-foreground hover:bg-muted"
                          }`}
                        >
                          <span
                            className="w-3.5 h-3.5 rounded-full shrink-0 shadow-xs"
                            style={{ backgroundColor: color.value }}
                          />
                          {color.label}
                        </button>
                      ))}
                      <input
                        type="color"
                        value={form.logoColor}
                        onChange={(e) => setForm((prev) => ({ ...prev, logoColor: e.target.value }))}
                        className="w-8 h-8 rounded-lg border border-border cursor-pointer p-0.5"
                        title="Pilih warna custom"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 bg-muted/40 p-3.5 rounded-xl border border-border">
                  <div>
                    <label className="block text-xs font-semibold mb-1">Upload File Logo Toko</label>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="text-xs file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-primary file:text-white hover:file:bg-primary-hover file:cursor-pointer"
                    />
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Format: PNG, JPG, WEBP, SVG (Maks. 1.5MB). Logo persegi atau bulat disarankan.
                    </p>
                  </div>

                  {form.logoUrl && (
                    <div className="flex items-center gap-3 pt-1">
                      <img
                        src={form.logoUrl}
                        alt="Logo Preview"
                        className="w-16 h-16 rounded-xl object-cover border border-border shadow-sm"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setForm((prev) => ({ ...prev, logoUrl: "" }));
                          if (fileInputRef.current) fileInputRef.current.value = "";
                        }}
                        className="text-xs text-danger font-semibold hover:underline"
                      >
                        Hapus Logo Gambar
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={saving}
                className="btn-primary w-full py-3.5 text-base font-semibold shadow-sm flex items-center justify-center gap-2"
              >
                {saving ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Menyimpan...
                  </>
                ) : (
                  "Simpan Pengaturan Toko"
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 2: RESET DATA */}
      {tab === "reset" && (
        <div className="space-y-4">
          <div className="rounded-xl bg-danger-soft/60 border border-danger/25 p-4 sm:p-5 space-y-2">
            <div className="flex items-center gap-2 text-danger font-bold text-base">
              <span>⚠️</span>
              <h2>Zona Bahaya: Reset Database</h2>
            </div>
            <p className="text-xs sm:text-sm text-foreground/80 leading-relaxed">
              Fitur reset digunakan saat toko Anda ingin memulai pembukuan baru dari angka 0, misalnya setelah masa
              uji coba, awal tahun buku baru, atau peralihan manajemen toko. Tindakan ini tidak dapat dibatalkan.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Opsi 1: Reset Transaksi */}
            <div className="card-surface p-4 sm:p-5 space-y-3 flex flex-col justify-between border-amber-300/80 bg-amber-50/30">
              <div className="space-y-2">
                <div className="inline-block px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800">
                  Direkomendasikan Untuk Pembukuan Baru
                </div>
                <h3 className="font-bold text-base text-foreground">1. Reset Transaksi & Keuangan (Stok = 0)</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Menghapus semua riwayat transaksi penjualan, pembelanjaan, piutang pelanggan, hutang supplier, catatan
                  modal, dan <strong>mengatur stok semua produk menjadi 0</strong>.
                </p>
                <ul className="text-xs text-muted-foreground space-y-1 pt-1 list-disc list-inside">
                  <li>✅ Katalog nama produk, harga, dan resep <strong>TETAP ADA</strong></li>
                  <li>✅ Akun kasir dan owner <strong>TETAP ADA</strong></li>
                  <li>🧹 Saldo kas, omset, dan stok bersih kembali ke <strong>0</strong></li>
                </ul>
              </div>

              <button
                type="button"
                onClick={() => {
                  setResetMode("transaksi");
                  setResetConfirmText("");
                  setResetModalOpen(true);
                }}
                className="w-full py-3 rounded-xl font-semibold text-sm border border-amber-500 bg-amber-500 text-white hover:bg-amber-600 active:scale-98 transition-all shadow-sm mt-2"
              >
                Reset Transaksi Saja (Stok 0)
              </button>
            </div>

            {/* Opsi 2: Reset Total Pabrik */}
            <div className="card-surface p-4 sm:p-5 space-y-3 flex flex-col justify-between border-danger/30 bg-danger-soft/20">
              <div className="space-y-2">
                <div className="inline-block px-2.5 py-1 rounded-full text-[11px] font-bold bg-danger/10 text-danger">
                  Setelan Awal Pabrik
                </div>
                <h3 className="font-bold text-base text-danger">2. Reset Total Semua Data</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Menghapus seluruh database secara total: semua transaksi, seluruh katalog produk, stok opname, modal,
                  serta menghapus semua akun kasir tambahan.
                </p>
                <ul className="text-xs text-muted-foreground space-y-1 pt-1 list-disc list-inside text-danger/80">
                  <li>🗑️ Seluruh data produk dan resep <strong>DIHAPUS</strong></li>
                  <li>🗑️ Akun user kasir tambahan <strong>DIHAPUS</strong></li>
                  <li>🔑 Hanya menyisakan user <code>owner</code> (password: <code>admin123</code>)</li>
                </ul>
              </div>

              <button
                type="button"
                onClick={() => {
                  setResetMode("total");
                  setResetConfirmText("");
                  setResetModalOpen(true);
                }}
                className="w-full py-3 rounded-xl font-semibold text-sm bg-danger text-white hover:bg-danger-hover active:scale-98 transition-all shadow-sm mt-2"
              >
                Reset Total Pabrik (Semua Bersih)
              </button>
            </div>
          </div>

          {/* Modal Konfirmasi Reset */}
          {resetModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
              <div className="card-surface max-w-md w-full p-5 sm:p-6 space-y-4 shadow-xl border-danger/40">
                <div className="flex items-center gap-2.5 text-danger font-bold text-lg">
                  <span className="text-2xl">⚠️</span>
                  <h3>Konfirmasi Reset Data</h3>
                </div>

                <p className="text-sm text-foreground/90 leading-relaxed">
                  {resetMode === "transaksi" ? (
                    <>
                      Anda akan mengosongkan <strong>seluruh riwayat penjualan, kas, hutang, dan mengeset stok semua produk jadi 0</strong>. Katalog produk tetap ada.
                    </>
                  ) : (
                    <>
                      Anda akan menghapus <strong>SEMUA DATA secara permanen</strong> termasuk seluruh produk dan akun kasir.
                    </>
                  )}
                </p>

                <div className="bg-muted p-3 rounded-xl space-y-1.5">
                  <label className="block text-xs font-semibold text-foreground">
                    Ketik kata <span className="text-danger font-mono font-bold text-sm">RESET</span> di bawah untuk melanjutkan:
                  </label>
                  <input
                    type="text"
                    value={resetConfirmText}
                    onChange={(e) => setResetConfirmText(e.target.value)}
                    placeholder="Ketik RESET"
                    autoFocus
                    className="input-field text-center text-base font-bold font-mono tracking-widest uppercase border-danger/40"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={handleExecuteReset}
                    disabled={resetting || resetConfirmText.trim().toUpperCase() !== "RESET"}
                    className="flex-1 py-3 rounded-xl font-bold text-sm bg-danger text-white hover:bg-danger-hover disabled:opacity-40 transition-colors shadow-sm"
                  >
                    {resetting ? "Memproses..." : "Ya, Reset Data Sekarang"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setResetModalOpen(false)}
                    disabled={resetting}
                    className="px-4 py-3 rounded-xl font-semibold text-sm border border-border bg-surface text-foreground hover:bg-muted transition-colors"
                  >
                    Batal
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: RIWAYAT & MASALAH YANG DISELESAIKAN (HISTORY APPS) */}
      {tab === "history" && (
        <div className="space-y-5">
          <div className="card-surface p-4 sm:p-5 bg-gradient-to-r from-primary-soft/40 to-surface border-primary/20 space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-xl">🏆</span>
              <h2 className="text-base sm:text-lg font-bold text-foreground">
                Riwayat & Solusi Masalah Toko Beras
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              Aplikasi ini dirancang khusus dari pengalaman nyata operasional toko beras & sembako untuk menghilangkan
              selisih uang kas, salah hitung timbangan, kerugian stok, dan nota hutang yang tercecer.
            </p>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {SOLVED_PROBLEMS.map((item, idx) => (
              <div
                key={item.id}
                className="card-surface p-4 sm:p-5 space-y-2.5 hover:border-primary/40 transition-all hover:shadow-md"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl p-2 rounded-xl bg-primary-soft/60 shrink-0">{item.icon}</span>
                    <div>
                      <span className="text-[10px] font-bold text-primary uppercase tracking-wider block">
                        #{idx + 1} · {item.badge}
                      </span>
                      <h3 className="text-sm sm:text-base font-bold text-foreground leading-snug">
                        {item.title}
                      </h3>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 text-xs pt-1 border-t border-border/80">
                  <div className="rounded-lg bg-danger-soft/40 p-2.5 border border-danger/10">
                    <span className="font-bold text-danger block mb-0.5">Masalah Nyata:</span>
                    <p className="text-foreground/80 leading-relaxed">{item.problem}</p>
                  </div>

                  <div className="rounded-lg bg-primary-soft/40 p-2.5 border border-primary/10">
                    <span className="font-bold text-primary block mb-0.5">Solusi Sistem:</span>
                    <p className="text-foreground/80 leading-relaxed">{item.solution}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Summary Box */}
          <div className="card-surface p-4 sm:p-5 text-center space-y-2 bg-muted/40">
            <p className="font-bold text-sm text-foreground">
              Aplikasi Beras Andalan Keluarga — Solusi Lengkap Kasir & Manajemen Toko Beras
            </p>
            <p className="text-xs text-muted-foreground max-w-xl mx-auto">
              Dibangun dengan Next.js 16 + PostgreSQL + Prisma ORM dengan fitur Offline-Ready (PWA) dan Audit Trail otomatis.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
