"use client";

import { useEffect, useState } from "react";
import { ModalEntry } from "@/types";

export default function ModalPage() {
  const [modal, setModal] = useState<ModalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ jumlah: "", tanggal: new Date().toISOString().slice(0, 10), keterangan: "" });
  const [error, setError] = useState("");

  async function fetchModal() { const res = await fetch("/api/modal"); const data = await res.json(); if (Array.isArray(data)) setModal(data); setLoading(false); }
  useEffect(() => { fetchModal(); }, []);

  function openAdd() { setEditId(null); setForm({ jumlah: "", tanggal: new Date().toISOString().slice(0, 10), keterangan: "" }); setShowForm(true); setError(""); }
  function openEdit(m: ModalEntry) { setEditId(m.id); setForm({ jumlah: String(m.jumlah), tanggal: m.tanggal.slice(0, 10), keterangan: m.keterangan || "" }); setShowForm(true); setError(""); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setError("");
    const body = { ...form, jumlah: Number(form.jumlah) };
    const url = editId ? `/api/modal/${editId}` : "/api/modal"; const method = editId ? "PUT" : "POST";
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (res.ok) { setShowForm(false); fetchModal(); } else { const data = await res.json(); setError(data.error || "Gagal menyimpan"); }
  }

  async function handleDelete(id: string) { if (!confirm("Hapus catatan modal ini?")) return; await fetch(`/api/modal/${id}`, { method: "DELETE" }); fetchModal(); }

  function formatRupiah(n: number) { return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n); }

  const totalModal = modal.reduce((sum, m) => sum + m.jumlah, 0);

  return (
    <div className="page-wrap space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-bold">Modal Awal</h2>
        <button onClick={openAdd} className="bg-primary text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-primary-hover active:bg-primary-hover/80 transition-colors shadow-sm">+ Tambah Modal</button>
      </div>

      <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 text-center shadow-sm">
        <p className="text-xs text-primary/70 font-medium">Total Modal Masuk</p>
        <p className="text-2xl font-bold text-primary font-mono mt-0.5">{formatRupiah(totalModal)}</p>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white border border-border rounded-xl p-4 space-y-3.5 shadow-sm">
          <h3 className="font-semibold text-[15px]">{editId ? "Edit Modal" : "Tambah Modal"}</h3>
          <div><label className="block text-sm font-medium mb-1">Jumlah (Rp)</label><input type="number" value={form.jumlah} onChange={(e) => setForm({ ...form, jumlah: e.target.value })} required className="w-full px-3 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" inputMode="numeric" /></div>
          <div><label className="block text-sm font-medium mb-1">Tanggal</label><input type="date" value={form.tanggal} onChange={(e) => setForm({ ...form, tanggal: e.target.value })} required className="w-full px-3 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" /></div>
          <div><label className="block text-sm font-medium mb-1">Keterangan</label><input type="text" value={form.keterangan} onChange={(e) => setForm({ ...form, keterangan: e.target.value })} className="w-full px-3 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" placeholder="Contoh: Modal awal usaha" /></div>
          {error && <p className="text-danger text-sm font-medium">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button type="submit" className="flex-1 bg-primary text-white py-3 rounded-lg font-semibold hover:bg-primary-hover active:bg-primary-hover/80 transition-colors shadow-sm">Simpan</button>
            <button type="button" onClick={() => setShowForm(false)} className="px-5 py-3 border border-border rounded-lg text-muted-foreground font-medium hover:bg-muted active:bg-border transition-colors">Batal</button>
          </div>
        </form>
      )}

      {loading ? (<div className="text-center py-10"><div className="inline-block w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /><p className="text-muted-foreground text-sm mt-2">Memuat...</p></div>)
      : modal.length === 0 ? (<div className="text-center py-10 bg-white border border-dashed border-border rounded-xl"><p className="text-muted-foreground text-sm">Belum ada catatan modal</p></div>)
      : (<div className="space-y-2">{modal.map((m) => (
            <div key={m.id} className="bg-white border border-border rounded-xl p-3 shadow-sm">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-mono font-bold text-primary text-[15px]">{formatRupiah(m.jumlah)}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{new Date(m.tanggal).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</p>
                </div>
                <div className="flex flex-col gap-0.5">
                  <button onClick={() => openEdit(m)} className="px-2.5 py-1 text-xs text-primary font-medium hover:bg-primary/10 rounded transition-colors">Edit</button>
                  <button onClick={() => handleDelete(m.id)} className="px-2.5 py-1 text-xs text-danger font-medium hover:bg-red-50 rounded transition-colors">Hapus</button>
                </div>
              </div>
              {m.keterangan && <p className="text-sm text-muted-foreground mt-1">{m.keterangan}</p>}
            </div>
          ))}</div>)}
    </div>
  );
}
