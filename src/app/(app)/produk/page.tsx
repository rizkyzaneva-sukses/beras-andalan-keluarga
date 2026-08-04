"use client";

import { useEffect, useState } from "react";
import { Product } from "@/types";

export default function ProdukPage() {
  const [produk, setProduk] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ nama: "", satuan: "kg", hargaBeli: "", hargaJual: "" });
  const [error, setError] = useState("");

  async function fetchProduk() { const res = await fetch("/api/produk"); const data = await res.json(); if (Array.isArray(data)) setProduk(data); setLoading(false); }
  useEffect(() => { fetchProduk(); }, []);

  function openAdd() { setEditId(null); setForm({ nama: "", satuan: "kg", hargaBeli: "", hargaJual: "" }); setShowForm(true); setError(""); }
  function openEdit(p: Product) { setEditId(p.id); setForm({ nama: p.nama, satuan: p.satuan, hargaBeli: String(p.hargaBeli), hargaJual: String(p.hargaJual) }); setShowForm(true); setError(""); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setError("");
    const body = { ...form, hargaBeli: Number(form.hargaBeli), hargaJual: Number(form.hargaJual) };
    const url = editId ? `/api/produk/${editId}` : "/api/produk";
    const method = editId ? "PUT" : "POST";
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (res.ok) { setShowForm(false); fetchProduk(); } else { const data = await res.json(); setError(data.error || "Gagal menyimpan"); }
  }

  async function handleDelete(id: string) { if (!confirm("Hapus produk ini?")) return; await fetch(`/api/produk/${id}`, { method: "DELETE" }); fetchProduk(); }

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-bold">Master Produk</h2>
        <button onClick={openAdd} className="bg-primary text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-primary-hover active:bg-primary-hover/80 transition-colors shadow-sm">+ Tambah</button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white border border-border rounded-xl p-4 space-y-3.5 shadow-sm">
          <h3 className="font-semibold text-[15px]">{editId ? "Edit Produk" : "Tambah Produk"}</h3>
          <div><label className="block text-sm font-medium mb-1">Nama Produk</label><input type="text" value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} required className="w-full px-3 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" placeholder="Contoh: Beras Pandan Wangi" /></div>
          <div><label className="block text-sm font-medium mb-1">Satuan</label><select value={form.satuan} onChange={(e) => setForm({ ...form, satuan: e.target.value })} className="w-full px-3 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-white"><option value="kg">Kg</option><option value="karung">Karung</option><option value="liter">Liter</option></select></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-sm font-medium mb-1">Harga Beli (Rp)</label><input type="number" value={form.hargaBeli} onChange={(e) => setForm({ ...form, hargaBeli: e.target.value })} required className="w-full px-3 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" inputMode="numeric" /></div>
            <div><label className="block text-sm font-medium mb-1">Harga Jual (Rp)</label><input type="number" value={form.hargaJual} onChange={(e) => setForm({ ...form, hargaJual: e.target.value })} required className="w-full px-3 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" inputMode="numeric" /></div>
          </div>
          {error && <p className="text-danger text-sm font-medium">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button type="submit" className="flex-1 bg-primary text-white py-3 rounded-lg font-semibold hover:bg-primary-hover active:bg-primary-hover/80 transition-colors shadow-sm">Simpan</button>
            <button type="button" onClick={() => setShowForm(false)} className="px-5 py-3 border border-border rounded-lg text-muted-foreground font-medium hover:bg-muted active:bg-border transition-colors">Batal</button>
          </div>
        </form>
      )}

      {loading ? (<div className="text-center py-10"><div className="inline-block w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /><p className="text-muted-foreground text-sm mt-2">Memuat...</p></div>)
      : produk.length === 0 ? (<div className="text-center py-10 bg-white border border-dashed border-border rounded-xl"><p className="text-muted-foreground text-sm">Belum ada produk</p></div>)
      : (<div className="space-y-2">{produk.map((p) => (
            <div key={p.id} className="bg-white border border-border rounded-xl p-3 flex items-center justify-between shadow-sm">
              <div className="min-w-0 flex-1 mr-2">
                <p className="font-medium text-[15px] truncate">{p.nama}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Beli: Rp {p.hargaBeli.toLocaleString("id-ID")} / Jual: Rp {p.hargaJual.toLocaleString("id-ID")} &middot; {p.satuan}</p>
              </div>
              <div className="flex flex-col gap-0.5 shrink-0">
                <button onClick={() => openEdit(p)} className="px-2.5 py-1 text-xs text-primary font-medium hover:bg-primary/10 rounded transition-colors">Edit</button>
                <button onClick={() => handleDelete(p.id)} className="px-2.5 py-1 text-xs text-danger font-medium hover:bg-red-50 rounded transition-colors">Hapus</button>
              </div>
            </div>
          ))}</div>)}
    </div>
  );
}
