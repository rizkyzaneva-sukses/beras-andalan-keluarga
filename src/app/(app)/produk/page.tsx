"use client";

import { useEffect, useState } from "react";
import { Product } from "@/types";
import { digitsOnly, formatRibuan, formatRupiah } from "@/lib/money";

type StockMode = "isi" | "kurang" | "pindah" | null;

const SATUAN = [
  { value: "kg", label: "Kg" },
  { value: "karung", label: "Karung" },
  { value: "liter", label: "Liter" },
  { value: "pcs", label: "Pcs" },
  { value: "butir", label: "Butir" },
];

export default function ProdukPage() {
  const [produk, setProduk] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
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

  async function fetchProduk() {
    const res = await fetch("/api/produk");
    const data = await res.json();
    if (Array.isArray(data)) setProduk(data);
    setLoading(false);
  }
  useEffect(() => {
    fetchProduk();
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
    setStockJumlah("");
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

  async function handleStock() {
    if (!stockId || !stockMode) return;
    setStockError("");
    const jumlah = Number(digitsOnly(stockJumlah));
    if (!jumlah || jumlah <= 0) {
      setStockError("Isi jumlah");
      return;
    }
    setStockSaving(true);
    try {
      if (stockMode === "pindah") {
        const toQty = Number(digitsOnly(pindahJumlahKe));
        if (!pindahKe) {
          setStockError("Pilih produk tujuan");
          setStockSaving(false);
          return;
        }
        if (!toQty || toQty <= 0) {
          setStockError("Isi jumlah yang ditambahkan ke produk eceran");
          setStockSaving(false);
          return;
        }
        const res = await fetch("/api/produk/konversi", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fromId: stockId, fromQty: jumlah, toId: pindahKe, toQty }),
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

  const active = produk.filter((p) => p.aktif !== false);
  const selected = active.find((p) => p.id === stockId) || null;
  const tujuanList = active.filter((p) => p.id !== stockId);

  return (
    <div className="page-wrap space-y-4">
      <div className="flex justify-between items-center gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Master Produk</h2>
          <p className="text-sm text-muted-foreground">Harga, satuan & stok. Isi stok di sini setelah buat barcode.</p>
        </div>
        <button onClick={openAdd} className="btn-primary px-4 py-2.5 text-sm shrink-0">
          + Tambah
        </button>
      </div>

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
          </h3>
          <p className="text-xs text-muted-foreground">
            Stok sekarang: <strong>{selected.stok} {selected.satuan}</strong>
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
          <div>
            <label className="block text-sm font-medium mb-1">
              {stockMode === "pindah" ? `Jumlah dikurangi (${selected.satuan})` : `Jumlah (${selected.satuan})`}
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={stockJumlah}
              onChange={(e) => setStockJumlah(digitsOnly(e.target.value))}
              className="w-full px-3 py-2.5 border border-border rounded-lg font-mono"
              placeholder="Contoh: 25"
            />
          </div>
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
                      {p.nama} · stok {p.stok} {p.satuan}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Jumlah ditambahkan ke tujuan</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={pindahJumlahKe}
                  onChange={(e) => setPindahJumlahKe(digitsOnly(e.target.value))}
                  className="w-full px-3 py-2.5 border border-border rounded-lg font-mono"
                  placeholder="Contoh: 25 (jika 1 karung = 25 kg)"
                />
              </div>
            </>
          )}
          {stockError && <p className="text-danger text-sm font-medium">{stockError}</p>}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={handleStock} disabled={stockSaving} className="flex-1 bg-primary text-white py-3 rounded-lg font-semibold disabled:opacity-50">
              {stockSaving ? "Menyimpan..." : "Simpan Stok"}
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
      ) : (
        <div className="grid sm:grid-cols-2 gap-2">
          {produk.map((p) => (
            <div key={p.id} className="card-surface p-3.5 space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-[15px] truncate">{p.nama}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Jual {formatRupiah(p.hargaJual)} · Beli {formatRupiah(p.hargaBeli)} · {p.satuan}
                  </p>
                  <p className={`text-sm font-bold mt-1.5 ${(p.stok ?? 0) <= 0 ? "text-danger" : (p.stok ?? 0) < 10 ? "text-warning" : "text-primary"}`}>
                    Stok: {p.stok ?? 0} {p.satuan}
                  </p>
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  <button onClick={() => openEdit(p)} className="px-3 py-1.5 text-xs text-primary font-semibold hover:bg-primary-soft rounded-lg transition-colors">
                    Edit
                  </button>
                  <button onClick={() => handleDelete(p.id)} className="px-3 py-1.5 text-xs text-danger font-semibold hover:bg-danger-soft rounded-lg transition-colors">
                    Hapus
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                <button onClick={() => openStock("isi", p)} className="py-2 rounded-lg text-[11px] font-semibold bg-primary-soft text-primary">
                  + Isi Stok
                </button>
                <button onClick={() => openStock("kurang", p)} className="py-2 rounded-lg text-[11px] font-semibold bg-muted text-muted-foreground">
                  − Kurangi
                </button>
                <button onClick={() => openStock("pindah", p)} className="py-2 rounded-lg text-[11px] font-semibold bg-amber-50 text-amber-800">
                  Pindah
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
