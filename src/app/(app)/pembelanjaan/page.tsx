"use client";

import { useEffect, useState } from "react";
import { PembelanjaanEntry, KategoriPembelanjaan, Product } from "@/types";
import { digitsOnly, formatRibuan, formatRupiah } from "@/lib/money";

type RangeKey = "today" | "week" | "month" | "custom";

export default function PembelanjaanPage() {
  const [data, setData] = useState<PembelanjaanEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ tanggal: new Date().toISOString().slice(0, 10), kategori: "RESTOCK" as KategoriPembelanjaan, namaBarang: "", jumlah: "", harga: "", statusBayar: "CASH" as "CASH" | "KREDIT", produkId: "" });
  const [produkList, setProdukList] = useState<Product[]>([]);
  const [error, setError] = useState("");
  const [range, setRange] = useState<RangeKey>("today");
  const [dateFrom, setDateFrom] = useState(new Date().toISOString().slice(0, 10));
  const [dateTo, setDateTo] = useState(new Date().toISOString().slice(0, 10));
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggest, setShowSuggest] = useState(false);

  function getRangeDates() {
    const today = new Date(); const todayStr = today.toISOString().slice(0, 10);
    if (range === "today") return { from: todayStr, to: todayStr };
    if (range === "week") { const s = new Date(today); s.setDate(today.getDate() - today.getDay()); return { from: s.toISOString().slice(0, 10), to: todayStr }; }
    if (range === "month") { const s = new Date(today.getFullYear(), today.getMonth(), 1); return { from: s.toISOString().slice(0, 10), to: todayStr }; }
    return { from: dateFrom, to: dateTo };
  }

  const { from, to } = getRangeDates();
  const isToday = range === "today";

  async function fetchData() {
    setLoading(true);
    const res = await fetch(`/api/pembelanjaan?from=${from}&to=${to}`);
    const json = await res.json();
    if (json.data) setData(json.data);
    setLoading(false);
  }

  useEffect(() => { fetchData(); }, [range, dateFrom, dateTo]);
  useEffect(() => {
    fetch("/api/produk")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setProdukList(data);
      })
      .catch(() => {});
  }, []);

  async function fetchSuggestions(q: string) {
    if (!q) { setSuggestions([]); setShowSuggest(false); return; }
    const res = await fetch(`/api/pembelanjaan/items?search=${encodeURIComponent(q)}`);
    const json = await res.json();
    setSuggestions(json.data || []);
    setShowSuggest(true);
  }

  function openAdd() {
    setEditId(null); setForm({ tanggal: new Date().toISOString().slice(0, 10), kategori: "RESTOCK", namaBarang: "", jumlah: "", harga: "", statusBayar: "CASH", produkId: "" });
    setShowForm(true); setError(""); setSuggestions([]); setShowSuggest(false);
  }

  function openEdit(p: PembelanjaanEntry) {
    setEditId(p.id); setForm({ tanggal: p.tanggal.slice(0, 10), kategori: p.kategori, namaBarang: p.namaBarang, jumlah: String(p.jumlah), harga: String(p.harga), statusBayar: p.statusBayar, produkId: p.produkId || "" });
    setShowForm(true); setError(""); setSuggestions([]); setShowSuggest(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setError("");
    const jumlah = Number(digitsOnly(form.jumlah)); const harga = Number(digitsOnly(form.harga)); const total = jumlah * harga;
    const body = { ...form, jumlah, harga, total };
    const url = editId ? `/api/pembelanjaan/${editId}` : "/api/pembelanjaan"; const method = editId ? "PUT" : "POST";
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (res.ok) { setShowForm(false); fetchData(); } else { const json = await res.json(); setError(json.error || "Gagal menyimpan"); }
  }

  async function handleDelete(id: string) { if (!confirm("Hapus catatan pengeluaran ini?")) return; await fetch(`/api/pembelanjaan/${id}`, { method: "DELETE" }); fetchData(); }

  const kategoryLabel: Record<string, string> = { RESTOCK: "Restock Barang", OPERASIONAL: "Operasional", LAINNYA: "Lainnya" };
  const rangeLabels: Record<RangeKey, string> = { today: "Hari Ini", week: "Minggu Ini", month: "Bulan Ini", custom: "Custom" };

  const total = data.reduce((s, p) => s + p.total, 0);

  return (
    <div className="page-wrap space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-bold">Pengeluaran</h2>
        <button onClick={openAdd} className="bg-primary text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-primary-hover active:bg-primary-hover/80 transition-colors shadow-sm">+ Tambah</button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {(Object.keys(rangeLabels) as RangeKey[]).map((r) => (
          <button key={r} onClick={() => setRange(r)} className={`px-3.5 py-2 rounded-lg text-[13px] font-medium transition-colors ${range === r ? "bg-primary text-white shadow-sm" : "bg-white border border-border text-muted-foreground hover:bg-muted active:bg-border"}`}>{rangeLabels[r]}</button>
        ))}
      </div>

      {range === "custom" && (
        <div className="flex gap-2 items-center">
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="border border-border rounded-lg px-3 py-2.5 text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
          <span className="text-muted-foreground text-sm">s/d</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="border border-border rounded-lg px-3 py-2.5 text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
        </div>
      )}

      <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center shadow-sm">
        <p className="text-xs text-red-700 font-medium">Total Pengeluaran</p>
        <p className="text-2xl font-bold text-red-800 font-mono mt-0.5">{formatRupiah(total)}</p>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white border border-border rounded-xl p-4 space-y-3.5 shadow-sm">
          <h3 className="font-semibold text-[15px]">{editId ? "Edit Pengeluaran" : "Tambah Pengeluaran"}</h3>
          <div><label className="block text-sm font-medium mb-1">Tanggal</label><input type="date" value={form.tanggal} onChange={(e) => setForm({ ...form, tanggal: e.target.value })} required className="w-full px-3 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" /></div>
          <div><label className="block text-sm font-medium mb-1">Kategori</label><select value={form.kategori} onChange={(e) => setForm({ ...form, kategori: e.target.value as KategoriPembelanjaan, produkId: "", namaBarang: e.target.value === "RESTOCK" ? form.namaBarang : form.namaBarang })} className="w-full px-3 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-white"><option value="RESTOCK">Restock Barang</option><option value="OPERASIONAL">Operasional</option><option value="LAINNYA">Lainnya</option></select></div>
          <div><label className="block text-sm font-medium mb-1">Status Bayar</label>
            <div className="flex gap-2">
              <button type="button" onClick={() => setForm({ ...form, statusBayar: "CASH" })} className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition-colors ${form.statusBayar === "CASH" ? "bg-green-600 text-white border-green-600 shadow-sm" : "border-border text-muted-foreground hover:bg-muted active:bg-border"}`}>Cash</button>
              <button type="button" onClick={() => setForm({ ...form, statusBayar: "KREDIT" })} className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition-colors ${form.statusBayar === "KREDIT" ? "bg-amber-600 text-white border-amber-600 shadow-sm" : "border-border text-muted-foreground hover:bg-muted active:bg-border"}`}>Kredit</button>
            </div>
          </div>
          {form.kategori === "RESTOCK" ? (
            <div>
              <label className="block text-sm font-medium mb-1">Nama Produk (dari Master Produk)</label>
              {produkList.length === 0 ? (
                <p className="text-sm text-danger">Belum ada produk. Tambah dulu di menu Produk, lalu isi stok di sini.</p>
              ) : (
                <select
                  value={form.produkId}
                  required
                  onChange={(e) => {
                    const p = produkList.find((x) => x.id === e.target.value);
                    setForm({ ...form, produkId: e.target.value, namaBarang: p?.nama || "", harga: p ? String(p.hargaBeli) : form.harga });
                  }}
                  className="w-full px-3 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-white"
                >
                  <option value="">Pilih produk...</option>
                  {produkList.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nama} · stok {p.stok} {p.satuan}
                    </option>
                  ))}
                </select>
              )}
              <p className="text-[11px] text-muted-foreground mt-1">Semua produk yang sudah dibuat (beserta barcode) muncul di sini.</p>
            </div>
          ) : (
            <div className="relative">
              <label className="block text-sm font-medium mb-1">Nama Barang/Biaya</label>
              <input type="text" value={form.namaBarang} onChange={(e) => { setForm({ ...form, namaBarang: e.target.value }); fetchSuggestions(e.target.value); }} onFocus={() => { if (suggestions.length > 0) setShowSuggest(true); }} onBlur={() => setTimeout(() => setShowSuggest(false), 200)} required className="w-full px-3 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" placeholder="Ketik nama, pilih dari history atau tulis baru" />
              {showSuggest && suggestions.length > 0 && (
                <div className="absolute z-20 left-0 right-0 mt-0.5 bg-white border border-border rounded-lg shadow-lg max-h-44 overflow-y-auto">
                  {suggestions.map((name) => (
                    <button key={name} type="button" onMouseDown={(e) => { e.preventDefault(); setForm({ ...form, namaBarang: name }); setShowSuggest(false); }} className={`w-full text-left px-3 py-2.5 text-sm hover:bg-muted transition-colors border-b border-border last:border-b-0 ${form.namaBarang === name ? "bg-primary/5 font-medium" : ""}`}>{name}</button>
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-sm font-medium mb-1">Jumlah</label><input type="text" value={form.jumlah} onChange={(e) => setForm({ ...form, jumlah: digitsOnly(e.target.value) })} required className="w-full px-3 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary font-mono" inputMode="numeric" /></div>
            <div><label className="block text-sm font-medium mb-1">Harga Satuan (Rp)</label><input type="text" value={formatRibuan(digitsOnly(form.harga))} onChange={(e) => setForm({ ...form, harga: digitsOnly(e.target.value) })} required className="w-full px-3 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary font-mono" inputMode="numeric" /></div>
          </div>
          {form.jumlah && form.harga && (<div className="bg-red-50 rounded-xl p-3 text-center border border-red-200"><span className="text-xs text-red-700">Total: </span><span className="font-mono font-bold text-xl text-red-800">{formatRupiah(Number(digitsOnly(form.jumlah)) * Number(digitsOnly(form.harga)))}</span></div>)}
          {error && <p className="text-danger text-sm font-medium">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button type="submit" className="flex-1 bg-primary text-white py-3 rounded-lg font-semibold hover:bg-primary-hover active:bg-primary-hover/80 transition-colors shadow-sm">Simpan</button>
            <button type="button" onClick={() => setShowForm(false)} className="px-5 py-3 border border-border rounded-lg text-muted-foreground font-medium hover:bg-muted active:bg-border transition-colors">Batal</button>
          </div>
        </form>
      )}

      {loading ? (<div className="text-center py-10"><div className="inline-block w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /><p className="text-muted-foreground text-sm mt-2">Memuat...</p></div>)
      : data.length === 0 ? (<div className="text-center py-10 bg-white border border-dashed border-border rounded-xl"><p className="text-muted-foreground text-sm">Belum ada pengeluaran</p></div>)
      : (<div className="space-y-2">{data.map((p) => (
        <div key={p.id} className="bg-white border border-border rounded-xl p-3 shadow-sm">
          <div className="flex justify-between items-start gap-2">
            <div className="flex-1 min-w-0">
              <p className="font-medium text-[15px]">{p.namaBarang}</p>
              <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-muted-foreground mt-0.5">
                <span className="px-1.5 py-0.5 bg-muted rounded text-[11px] font-medium">{kategoryLabel[p.kategori]}</span>
                {p.statusBayar === "KREDIT" && <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-[11px] font-medium">Kredit</span>}
                <span>{p.jumlah} &times; {formatRupiah(p.harga)}</span>
                <span>{new Date(p.tanggal).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="font-mono font-bold text-[15px] text-red-600">{formatRupiah(p.total)}</span>
              {isToday && <div className="flex flex-col gap-0.5">
                <button onClick={() => openEdit(p)} className="px-2 py-1 text-xs text-primary font-medium hover:bg-primary/10 rounded transition-colors">Edit</button>
                <button onClick={() => handleDelete(p.id)} className="px-2 py-1 text-xs text-danger font-medium hover:bg-red-50 rounded transition-colors">Hapus</button>
              </div>}
            </div>
          </div>
        </div>
      ))}</div>)}
    </div>
  );
}
