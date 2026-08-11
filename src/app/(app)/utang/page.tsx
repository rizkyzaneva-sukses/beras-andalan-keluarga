"use client";

import { useEffect, useState } from "react";

interface UtangItem { id: string; tanggal: string; namaBarang: string; kategori: string; total: number; sudahDibayar: number; }

export default function UtangPage() {
  const [utang, setUtang] = useState<UtangItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [payId, setPayId] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [error, setError] = useState("");

  async function fetchUtang() { const res = await fetch("/api/utang"); const json = await res.json(); if (json.data) setUtang(json.data); setLoading(false); }
  useEffect(() => { fetchUtang(); }, []);

  async function handleBayar() {
    if (!payId || !payAmount) return; setError("");
    const res = await fetch("/api/utang/bayar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pembelanjaanId: payId, jumlah: Number(payAmount) }) });
    const json = await res.json();
    if (res.ok) { setPayId(null); setPayAmount(""); fetchUtang(); }
    else setError(json.error || "Gagal");
  }

  function formatRupiah(n: number) { return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n); }
  const totalUtang = utang.reduce((s, u) => s + (u.total - u.sudahDibayar), 0);
  const kategoriLabel: Record<string, string> = { RESTOCK: "Restock", OPERASIONAL: "Operasional", LAINNYA: "Lainnya" };

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <h2 className="text-lg font-bold">Utang</h2>

      <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center shadow-sm">
        <p className="text-xs text-red-700 font-medium">Total Utang Belum Lunas</p>
        <p className="text-2xl font-bold text-red-800 font-mono mt-0.5">{formatRupiah(totalUtang)}</p>
      </div>

      {loading ? (<div className="text-center py-10"><div className="inline-block w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /><p className="text-muted-foreground text-sm mt-2">Memuat...</p></div>)
      : utang.length === 0 ? (<div className="text-center py-10 bg-white border border-dashed border-border rounded-xl"><p className="text-muted-foreground text-sm">Tidak ada utang</p></div>)
      : (<div className="space-y-2">{utang.map((u) => {
        const sisa = u.total - u.sudahDibayar;
        const persen = Math.round((u.sudahDibayar / u.total) * 100);
        return (
          <div key={u.id} className="bg-white border border-border rounded-xl p-3 shadow-sm">
            <div className="flex justify-between items-start gap-2 mb-2">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-[15px]">{u.namaBarang}</p>
                <div className="flex gap-2 text-xs text-muted-foreground mt-0.5">
                  <span>{kategoriLabel[u.kategori] || u.kategori}</span>
                  <span>{new Date(u.tanggal).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}</span>
                </div>
              </div>
              <span className="font-mono font-bold text-[15px] text-red-600">{formatRupiah(sisa)}</span>
            </div>
            <div className="bg-muted rounded-lg h-2 mb-2 overflow-hidden"><div className="bg-primary h-full rounded-lg transition-all" style={{ width: `${persen}%` }} /></div>
            <div className="flex justify-between text-xs text-muted-foreground mb-2"><span>Dibayar: {formatRupiah(u.sudahDibayar)}</span><span>Total: {formatRupiah(u.total)}</span></div>
            {payId === u.id ? (
              <div className="flex gap-2 items-end">
                <div className="flex-1"><label className="text-[11px] font-medium">Jumlah Bayar</label><input type="number" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" placeholder={formatRupiah(sisa)} inputMode="numeric" /></div>
                <button onClick={handleBayar} className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors">Bayar</button>
                <button onClick={() => { setPayId(null); setPayAmount(""); setError(""); }} className="text-muted-foreground text-sm">Batal</button>
              </div>
            ) : (
              <button onClick={() => { setPayId(u.id); setPayAmount(""); setError(""); }} className="text-primary text-sm font-medium hover:underline">+ Bayar Utang</button>
            )}
            {payId === u.id && error && <p className="text-danger text-xs mt-1">{error}</p>}
          </div>
        );
      })}</div>)}
    </div>
  );
}
