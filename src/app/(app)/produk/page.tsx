"use client";

import { useEffect, useMemo, useState } from "react";
import { Product, StokAdjustmentEntry } from "@/types";
import { digitsOnly, formatRibuan, formatRupiah } from "@/lib/money";
import { formatQty, isProdukTimbang, parseQtyInput, sanitizeQtyInput, toQty } from "@/lib/qty";

type StockMode = "isi" | "kurang" | "pindah" | "adjust" | null;

const SATUAN = [
  { value: "kg", label: "Kg" },
  { value: "karung", label: "Karung" },
  { value: "liter", label: "Liter" },
  { value: "pcs", label: "Pcs" },
  { value: "butir", label: "Butir" },
];

const ALASAN_SO = ["SO mingguan", "Rusak / pecah", "Hilang", "Salah catat", "Sample / bonus", "Lainnya"];

export default function ProdukPage() {
  const [produk, setProduk] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ nama: "", satuan: "kg", hargaBeli: "", hargaJual: "" });
  const [error, setError] = useState("");
  const [stockMode, setStockMode] = useState<StockMode>(null);
  const [stockId, setStockId] = useState<string | null>(null);
  const [stockJumlah, setStockJumlah] = useState("");
  const [stockHarga, setStockHarga] = useState("");
  const [stockCatatan, setStockCatatan] = useState("");
  const [stockStatus, setStockStatus] = useState<"CASH" | "KREDIT">("CASH");
  const [pindahKe, setPindahKe] = useState("");
  const [pindahJumlahKe, setPindahJumlahKe] = useState("");
  const [stockError, setStockError] = useState("");
  const [stockSaving, setStockSaving] = useState(false);
  const [adjustments, setAdjustments] = useState<StokAdjustmentEntry[]>([]);
  const [historySearch, setHistorySearch] = useState("");

  async function fetchProduk() {
    const res = await fetch("/api/produk");
    const data = await res.json();
    if (Array.isArray(data)) setProduk(data);
    setLoading(false);
  }

  async function fetchAdjustments() {
    const res = await fetch("/api/produk/adjust?limit=40");
    const json = await res.json();
    if (Array.isArray(json.data)) setAdjustments(json.data);
  }

  useEffect(() => {
    fetchProduk();
    fetchAdjustments();
  }, []);

  function openAdd() {
    setEditId(null);
    setForm({ nama: "", satuan: "kg", hargaBeli: "", hargaJual: "" });
    setShowForm(true);
    setError("");
    closeStock();
  }
  function openEdit(p: Product) {
    setEditId(p.id);
    setForm({ nama: p.nama, satuan: p.satuan, hargaBeli: String(p.hargaBeli), hargaJual: String(p.hargaJual) });
    setShowForm(true);
    setError("");
    closeStock();
  }

  function openStock(mode: StockMode, p: Product) {
    setShowForm(false);
    setStockMode(mode);
    setStockId(p.id);
    setStockJumlah(mode === "adjust" ? formatQty(p.stok) : "");
    setStockHarga(mode === "isi" ? String(p.hargaBeli) : "");
    setStockCatatan("");
    setStockStatus("CASH");
    setPindahKe("");
    setPindahJumlahKe("");
    setStockError("");
  }

  function closeStock() {
    setStockMode(null);
    setStockId(null);
    setStockError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const body = { ...form, hargaBeli: Number(digitsOnly(form.hargaBeli)), hargaJual: Number(digitsOnly(form.hargaJual)) };
    const url = editId ? `/api/produk/${editId}` : "/api/produk";
    const method = editId ? "PUT" : "POST";
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (res.ok) {
      setShowForm(false);
      fetchProduk();
    } else {
      const data = await res.json();
      setError(data.error || "Gagal menyimpan");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Hapus produk ini?")) return;
    await fetch(`/api/produk/${id}`, { method: "DELETE" });
    fetchProduk();
  }

  const active = produk.filter((p) => p.aktif !== false);
  const selected = active.find((p) => p.id === stockId) || null;
  const tujuanList = active.filter((p) => p.id !== stockId);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q ? active.filter((p) => p.nama.toLowerCase().includes(q)) : active;
    return [...list].sort((a, b) => a.nama.localeCompare(b.nama, "id"));
  }, [active, search]);

  const filteredHistory = useMemo(() => {
    const q = historySearch.trim().toLowerCase();
    if (!q) return adjustments;
    return adjustments.filter(
      (row) =>
        row.produkNama.toLowerCase().includes(q) ||
        row.alasan.toLowerCase().includes(q) ||
        row.createdByUsername.toLowerCase().includes(q)
    );
  }, [adjustments, historySearch]);

  const adjustFisik = selected && stockMode === "adjust" ? parseQtyInput(stockJumlah) : NaN;
  const adjustSelisih = selected && Number.isFinite(adjustFisik) ? toQty(adjustFisik - toQty(selected.stok)) : NaN;

  async function handleStock() {
    if (!stockId || !stockMode) return;
    setStockError("");
    const fraction = selected && isProdukTimbang(selected.nama);

    if (stockMode === "adjust") {
      const fisik = parseQtyInput(stockJumlah);
      if (!Number.isFinite(fisik) || fisik < 0) {
        setStockError(fraction ? "Isi stok fisik, boleh pecahan (0,7 / 1/4)" : "Isi stok fisik hasil hitung");
        return;
      }
      if (!fraction && !Number.isInteger(fisik)) {
        setStockError("Stok fisik harus bilangan bulat");
        return;
      }
      const alasan = stockCatatan.trim();
      if (alasan.length < 3) {
        setStockError("Alasan penyesuaian wajib diisi");
        return;
      }
      setStockSaving(true);
      try {
        const res = await fetch(`/api/produk/${stockId}/adjust`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stokFisik: fisik, alasan }),
        });
        const json = await res.json();
        if (!res.ok) {
          setStockError(json.error || "Gagal menyesuaikan stok");
          return;
        }
        closeStock();
        fetchProduk();
        fetchAdjustments();
      } finally {
        setStockSaving(false);
      }
      return;
    }

    const jumlah = fraction ? parseQtyInput(stockJumlah) : Number(digitsOnly(stockJumlah));
    if (!jumlah || jumlah <= 0) {
      setStockError(fraction ? "Isi jumlah, boleh pecahan (0,7 / 1/4 / 1/2)" : "Isi jumlah");
      return;
    }
    setStockSaving(true);
    try {
      if (stockMode === "pindah") {
        const tujuan = tujuanList.find((p) => p.id === pindahKe);
        const toQtyVal = tujuan && isProdukTimbang(tujuan.nama) ? parseQtyInput(pindahJumlahKe) : Number(digitsOnly(pindahJumlahKe));
        if (!pindahKe) {
          setStockError("Pilih produk tujuan");
          setStockSaving(false);
          return;
        }
        if (!toQtyVal || toQtyVal <= 0) {
          setStockError("Isi jumlah yang ditambahkan ke produk eceran");
          setStockSaving(false);
          return;
        }
        const res = await fetch("/api/produk/konversi", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fromId: stockId, fromQty: jumlah, toId: pindahKe, toQty: toQtyVal }),
        });
        const json = await res.json();
        if (!res.ok) {
          setStockError(json.error || "Gagal memindah stok");
          return;
        }
      } else {
        const harga = stockMode === "isi" ? Number(digitsOnly(stockHarga)) : undefined;
        const res = await fetch(`/api/produk/${stockId}/stok`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            arah: stockMode === "isi" ? "tambah" : "kurang",
            jumlah,
            harga: harga && harga > 0 ? harga : undefined,
            statusBayar: stockStatus,
            catatan: stockCatatan || undefined,
          }),
        });
        const json = await res.json();
        if (!res.ok) {
          setStockError(json.error || "Gagal mengubah stok");
          return;
        }
      }
      closeStock();
      fetchProduk();
    } finally {
      setStockSaving(false);
    }
  }

  return (
    <div className="page-wrap space-y-4">
      <div className="flex justify-between items-center gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Master Produk</h2>
          <p className="text-sm text-muted-foreground">Tabel stok, pencarian, dan penyesuaian SO mingguan.</p>
        </div>
        <button onClick={openAdd} className="btn-primary px-4 py-2.5 text-sm shrink-0">
          + Tambah
        </button>
      </div>

      <div className="relative">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari produk..."
          className="input-field pl-9"
        />
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm pointer-events-none">⌕</span>
      </div>
      {!loading && (
        <p className="text-xs text-muted-foreground -mt-2">
          {search.trim() ? `${filtered.length} dari ${active.length} produk` : `${active.length} produk`}
        </p>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white border border-border rounded-xl p-4 space-y-3.5 shadow-sm">
          <h3 className="font-semibold text-[15px]">{editId ? "Edit Produk" : "Tambah Produk"}</h3>
          <div>
            <label className="block text-sm font-medium mb-1">Nama Produk</label>
            <input
              type="text"
              value={form.nama}
              onChange={(e) => setForm({ ...form, nama: e.target.value })}
              required
              className="w-full px-3 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              placeholder="Contoh: Beras Pandan Wangi / Telur"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Satuan</label>
            <select
              value={form.satuan}
              onChange={(e) => setForm({ ...form, satuan: e.target.value })}
              className="w-full px-3 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-white"
            >
              {SATUAN.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Harga Beli (Rp)</label>
              <input
                type="text"
                inputMode="numeric"
                value={formatRibuan(digitsOnly(form.hargaBeli))}
                onChange={(e) => setForm({ ...form, hargaBeli: digitsOnly(e.target.value) })}
                required
                className="w-full px-3 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary font-mono"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Harga Jual (Rp)</label>
              <input
                type="text"
                inputMode="numeric"
                value={formatRibuan(digitsOnly(form.hargaJual))}
                onChange={(e) => setForm({ ...form, hargaJual: digitsOnly(e.target.value) })}
                required
                className="w-full px-3 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary font-mono"
              />
            </div>
          </div>
          {error && <p className="text-danger text-sm font-medium">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button type="submit" className="flex-1 bg-primary text-white py-3 rounded-lg font-semibold hover:bg-primary-hover active:bg-primary-hover/80 transition-colors shadow-sm">
              Simpan
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="px-5 py-3 border border-border rounded-lg text-muted-foreground font-medium hover:bg-muted active:bg-border transition-colors">
              Batal
            </button>
          </div>
        </form>
      )}

      {stockMode && selected && (
        <div className="bg-white border border-border rounded-xl p-4 space-y-3.5 shadow-sm">
          <h3 className="font-semibold text-[15px]">
            {stockMode === "isi" && `Isi Stok · ${selected.nama}`}
            {stockMode === "kurang" && `Kurangi Stok · ${selected.nama}`}
            {stockMode === "pindah" && `Pindah Stok · ${selected.nama}`}
            {stockMode === "adjust" && `Penyesuaian SO · ${selected.nama}`}
          </h3>
          <p className="text-xs text-muted-foreground">
            Stok sistem: <strong>{formatQty(selected.stok)} {selected.satuan}</strong>
          </p>
          {stockMode === "isi" && (
            <p className="text-xs text-muted-foreground">
              Setelah produk & barcode dibuat, isi jumlah di sini. Nama produk sudah terpilih otomatis.
            </p>
          )}
          {stockMode === "pindah" && (
            <p className="text-xs text-muted-foreground">
              Untuk beras karungan yang dipecah jadi eceran. Stok karung berkurang, stok eceran bertambah. Harga tetap terpisah.
            </p>
          )}
          {stockMode === "adjust" && (
            <p className="text-xs text-muted-foreground">
              Isi stok fisik hasil hitung SO. Sistem akan menyesuaikan selisih. Alasan wajib diisi.
            </p>
          )}
          <div>
            <label className="block text-sm font-medium mb-1">
              {stockMode === "pindah"
                ? `Jumlah dikurangi (${selected.satuan})`
                : stockMode === "adjust"
                  ? `Stok fisik hasil hitung (${selected.satuan})`
                  : `Jumlah (${selected.satuan})`}
            </label>
            <input
              type="text"
              inputMode={isProdukTimbang(selected.nama) ? "decimal" : "numeric"}
              value={stockJumlah}
              onChange={(e) =>
                setStockJumlah(isProdukTimbang(selected.nama) ? sanitizeQtyInput(e.target.value) : digitsOnly(e.target.value))
              }
              className="w-full px-3 py-2.5 border border-border rounded-lg font-mono"
              placeholder={
                stockMode === "adjust"
                  ? isProdukTimbang(selected.nama)
                    ? "Contoh: 0,7"
                    : "Hasil hitung SO"
                  : isProdukTimbang(selected.nama)
                    ? "Contoh: 0,7 atau 10"
                    : "Contoh: 25"
              }
            />
            {isProdukTimbang(selected.nama) && (
              <p className="text-[11px] text-muted-foreground mt-1">Telur boleh pecahan: 0,7 · 1/4 · 1/3 · 1/2 kg.</p>
            )}
          </div>
          {stockMode === "adjust" && Number.isFinite(adjustSelisih) && (
            <div
              className={`rounded-xl px-3 py-2.5 text-sm font-semibold ${
                adjustSelisih === 0
                  ? "bg-muted text-muted-foreground"
                  : adjustSelisih > 0
                    ? "bg-primary-soft text-primary"
                    : "bg-danger-soft text-danger"
              }`}
            >
              {adjustSelisih === 0
                ? "Stok fisik sama dengan sistem — tidak perlu disesuaikan"
                : `Selisih ${adjustSelisih > 0 ? "+" : ""}${formatQty(adjustSelisih)} ${selected.satuan} (${adjustSelisih > 0 ? "lebih dari sistem" : "kurang dari sistem"})`}
            </div>
          )}
          {stockMode === "isi" && (
            <>
              <div>
                <label className="block text-sm font-medium mb-1">Harga beli satuan (opsional)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={formatRibuan(stockHarga)}
                  onChange={(e) => setStockHarga(digitsOnly(e.target.value))}
                  className="w-full px-3 py-2.5 border border-border rounded-lg font-mono"
                  placeholder="Isi jika ingin dicatat sebagai pengeluaran restock"
                />
                <p className="text-[11px] text-muted-foreground mt-1">Kosongkan jika belanja sudah dicatat di menu Pengeluaran.</p>
              </div>
              {stockHarga && Number(stockHarga) > 0 && (
                <div>
                  <label className="block text-sm font-medium mb-1">Status bayar restock</label>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setStockStatus("CASH")} className={`flex-1 py-2.5 rounded-lg text-sm font-medium border ${stockStatus === "CASH" ? "bg-green-600 text-white border-green-600" : "border-border text-muted-foreground"}`}>
                      Cash
                    </button>
                    <button type="button" onClick={() => setStockStatus("KREDIT")} className={`flex-1 py-2.5 rounded-lg text-sm font-medium border ${stockStatus === "KREDIT" ? "bg-amber-600 text-white border-amber-600" : "border-border text-muted-foreground"}`}>
                      Kredit
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
          {stockMode === "kurang" && (
            <div>
              <label className="block text-sm font-medium mb-1">Alasan (opsional)</label>
              <input
                type="text"
                value={stockCatatan}
                onChange={(e) => setStockCatatan(e.target.value)}
                className="w-full px-3 py-2.5 border border-border rounded-lg"
                placeholder="Rusak, sampel, pecah karung, dll"
              />
            </div>
          )}
          {stockMode === "adjust" && (
            <div>
              <label className="block text-sm font-medium mb-1">Alasan penyesuaian (wajib)</label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {ALASAN_SO.map((label) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setStockCatatan(label === "Lainnya" ? "" : label)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border ${
                      stockCatatan === label ? "bg-primary text-white border-primary" : "border-border bg-muted/70"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={stockCatatan}
                onChange={(e) => setStockCatatan(e.target.value)}
                className="w-full px-3 py-2.5 border border-border rounded-lg"
                placeholder="Contoh: SO minggu ke-2, kurang 2 kg karena pecah"
                required
              />
            </div>
          )}
          {stockMode === "pindah" && (
            <>
              <div>
                <label className="block text-sm font-medium mb-1">Pindah ke produk</label>
                <select
                  value={pindahKe}
                  onChange={(e) => setPindahKe(e.target.value)}
                  className="w-full px-3 py-2.5 border border-border rounded-lg bg-white"
                >
                  <option value="">Pilih produk eceran / tujuan</option>
                  {tujuanList.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nama} · stok {formatQty(p.stok)} {p.satuan}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Jumlah ditambahkan ke tujuan</label>
                <input
                  type="text"
                  inputMode={tujuanList.find((p) => p.id === pindahKe) && isProdukTimbang(tujuanList.find((p) => p.id === pindahKe)!.nama) ? "decimal" : "numeric"}
                  value={pindahJumlahKe}
                  onChange={(e) => {
                    const tujuan = tujuanList.find((p) => p.id === pindahKe);
                    setPindahJumlahKe(tujuan && isProdukTimbang(tujuan.nama) ? sanitizeQtyInput(e.target.value) : digitsOnly(e.target.value));
                  }}
                  className="w-full px-3 py-2.5 border border-border rounded-lg font-mono"
                  placeholder="Contoh: 25 (jika 1 karung = 25 kg)"
                />
              </div>
            </>
          )}
          {stockError && <p className="text-danger text-sm font-medium">{stockError}</p>}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={handleStock} disabled={stockSaving} className="flex-1 bg-primary text-white py-3 rounded-lg font-semibold disabled:opacity-50">
              {stockSaving ? "Menyimpan..." : stockMode === "adjust" ? "Simpan Penyesuaian" : "Simpan Stok"}
            </button>
            <button type="button" onClick={closeStock} className="px-5 py-3 border border-border rounded-lg text-muted-foreground font-medium">
              Batal
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-10">
          <div className="inline-block w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground text-sm mt-2">Memuat...</p>
        </div>
      ) : produk.length === 0 ? (
        <div className="text-center py-10 bg-white border border-dashed border-border rounded-xl">
          <p className="text-muted-foreground text-sm">Belum ada produk</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-10 bg-white border border-dashed border-border rounded-xl">
          <p className="text-muted-foreground text-sm">Tidak ada produk bernama “{search.trim()}”</p>
        </div>
      ) : (
        <div className="card-surface overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead>
                <tr className="bg-muted/70 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2.5 font-semibold">Produk</th>
                  <th className="px-3 py-2.5 font-semibold">Satuan</th>
                  <th className="px-3 py-2.5 font-semibold text-right">Harga jual</th>
                  <th className="px-3 py-2.5 font-semibold text-right">Stok</th>
                  <th className="px-3 py-2.5 font-semibold text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const stok = toQty(p.stok);
                  return (
                    <tr key={p.id} className="border-t border-border hover:bg-muted/40">
                      <td className="px-3 py-2.5">
                        <p className="font-semibold text-[13px]">{p.nama}</p>
                        <p className="text-[11px] text-muted-foreground">Beli {formatRupiah(p.hargaBeli)}</p>
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground">{p.satuan}</td>
                      <td className="px-3 py-2.5 text-right font-mono">{formatRupiah(p.hargaJual)}</td>
                      <td className={`px-3 py-2.5 text-right font-mono font-bold ${stok <= 0 ? "text-danger" : stok < 10 ? "text-warning" : "text-primary"}`}>
                        {formatQty(p.stok)}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex flex-wrap justify-end gap-1">
                          <button type="button" onClick={() => openStock("adjust", p)} className="px-2 py-1 rounded-md text-[11px] font-semibold bg-amber-50 text-amber-800">
                            SO
                          </button>
                          <button type="button" onClick={() => openStock("isi", p)} className="px-2 py-1 rounded-md text-[11px] font-semibold bg-primary-soft text-primary">
                            Isi
                          </button>
                          <button type="button" onClick={() => openStock("kurang", p)} className="px-2 py-1 rounded-md text-[11px] font-semibold bg-muted text-muted-foreground">
                            Kurangi
                          </button>
                          <button type="button" onClick={() => openStock("pindah", p)} className="px-2 py-1 rounded-md text-[11px] font-semibold bg-muted text-muted-foreground">
                            Pindah
                          </button>
                          <button type="button" onClick={() => openEdit(p)} className="px-2 py-1 rounded-md text-[11px] font-semibold text-primary hover:bg-primary-soft">
                            Edit
                          </button>
                          <button type="button" onClick={() => handleDelete(p.id)} className="px-2 py-1 rounded-md text-[11px] font-semibold text-danger hover:bg-danger-soft">
                            Hapus
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="space-y-2.5">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h3 className="font-semibold text-[15px]">Riwayat penyesuaian SO</h3>
            <p className="text-xs text-muted-foreground">Alasan tiap adjustment tersimpan di sini.</p>
          </div>
        </div>
        <input
          type="search"
          value={historySearch}
          onChange={(e) => setHistorySearch(e.target.value)}
          placeholder="Cari riwayat (produk / alasan / user)..."
          className="input-field py-2.5 text-sm"
        />
        {filteredHistory.length === 0 ? (
          <div className="text-center py-8 bg-white border border-dashed border-border rounded-xl">
            <p className="text-muted-foreground text-sm">
              {adjustments.length === 0 ? "Belum ada penyesuaian stok" : "Tidak ada riwayat yang cocok"}
            </p>
          </div>
        ) : (
          <div className="card-surface overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[680px]">
                <thead>
                  <tr className="bg-muted/70 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th className="px-3 py-2.5 font-semibold">Tanggal</th>
                    <th className="px-3 py-2.5 font-semibold">Produk</th>
                    <th className="px-3 py-2.5 font-semibold text-right">Sistem → Fisik</th>
                    <th className="px-3 py-2.5 font-semibold text-right">Selisih</th>
                    <th className="px-3 py-2.5 font-semibold">Alasan</th>
                    <th className="px-3 py-2.5 font-semibold">Oleh</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHistory.map((row) => (
                    <tr key={row.id} className="border-t border-border align-top">
                      <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(row.createdAt).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td className="px-3 py-2.5 font-medium">{row.produkNama}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-xs whitespace-nowrap">
                        {formatQty(row.stokSistem)} → {formatQty(row.stokFisik)} {row.satuan}
                      </td>
                      <td className={`px-3 py-2.5 text-right font-mono font-semibold ${row.selisih > 0 ? "text-primary" : "text-danger"}`}>
                        {row.selisih > 0 ? "+" : ""}
                        {formatQty(row.selisih)}
                      </td>
                      <td className="px-3 py-2.5 text-[13px]">{row.alasan}</td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">{row.createdByUsername}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
