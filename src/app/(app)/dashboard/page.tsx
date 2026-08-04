"use client";

import { useEffect, useState } from "react";
import { LaporanSummary, PenjualanEntry, PembelanjaanEntry } from "@/types";

type RangeKey = "today" | "week" | "month" | "custom";

interface PerDayEntry {
  tanggal: string;
  pendapatan: number;
  pengeluaran: number;
  labaRugi: number;
}

export default function DashboardPage() {
  const [range, setRange] = useState<RangeKey>("today");
  const [dateFrom, setDateFrom] = useState(new Date().toISOString().slice(0, 10));
  const [dateTo, setDateTo] = useState(new Date().toISOString().slice(0, 10));
  const [summary, setSummary] = useState<LaporanSummary | null>(null);
  const [penjualan, setPenjualan] = useState<PenjualanEntry[]>([]);
  const [pembelanjaan, setPembelanjaan] = useState<PembelanjaanEntry[]>([]);
  const [perDay, setPerDay] = useState<PerDayEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailTab, setDetailTab] = useState<"penjualan" | "pembelanjaan">("penjualan");
  const [resetting, setResetting] = useState(false);

  function getRangeDates(): { from: string; to: string } {
    const today = new Date(); const todayStr = today.toISOString().slice(0, 10);
    if (range === "today") return { from: todayStr, to: todayStr };
    if (range === "week") { const start = new Date(today); start.setDate(today.getDate() - today.getDay()); return { from: start.toISOString().slice(0, 10), to: todayStr }; }
    if (range === "month") { const start = new Date(today.getFullYear(), today.getMonth(), 1); return { from: start.toISOString().slice(0, 10), to: todayStr }; }
    return { from: dateFrom, to: dateTo };
  }

  function formatRupiah(n: number) { return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n); }

  async function fetchData() {
    const { from, to } = getRangeDates(); setLoading(true);
    const [summaryRes, penjualanRes, pembelanjaanRes, perDayRes] = await Promise.all([
      fetch(`/api/laporan/summary?from=${from}&to=${to}`).then((r) => r.json()),
      fetch(`/api/penjualan?from=${from}&to=${to}`).then((r) => r.json()),
      fetch(`/api/pembelanjaan?from=${from}&to=${to}`).then((r) => r.json()),
      fetch(`/api/laporan/per-hari?from=${from}&to=${to}`).then((r) => r.json()),
    ]);
    setSummary(summaryRes); setPenjualan(penjualanRes.data || []); setPembelanjaan(pembelanjaanRes.data || []); setPerDay(perDayRes.data || []); setLoading(false);
  }

  useEffect(() => { fetchData(); }, [range, dateFrom, dateTo]);

  async function handleSeedDummy() {
    if (!confirm("Buat data dummy? Ini akan menambah transaksi contoh untuk testing.")) return;
    const res = await fetch("/api/seed-dummy", { method: "POST" });
    const data = await res.json();
    if (data.success) { alert(data.message); fetchData(); } else { alert("Gagal: " + data.error); }
  }

  async function handleResetAll() {
    if (!confirm("HAPUS SEMUA DATA? Semua transaksi, produk, modal, dan user (kecuali admin) akan dihapus permanen. Lanjutkan?")) return;
    setResetting(true);
    const res = await fetch("/api/reset", { method: "POST" });
    const data = await res.json();
    setResetting(false);
    if (data.success) { alert(data.message); window.location.reload(); } else { alert("Gagal: " + data.error); }
  }

  const rangeLabels: Record<RangeKey, string> = { today: "Hari Ini", week: "Minggu Ini", month: "Bulan Ini", custom: "Custom" };

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <h2 className="text-lg font-bold">Dashboard</h2>

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

      {loading ? (
        <div className="text-center py-10"><div className="inline-block w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /><p className="text-muted-foreground text-sm mt-2">Memuat data...</p></div>
      ) : summary ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 shadow-sm"><p className="text-[11px] text-green-700 font-medium uppercase tracking-wide">Pendapatan</p><p className="text-lg font-bold text-green-800 font-mono mt-0.5 leading-tight">{formatRupiah(summary.totalPendapatan)}</p></div>
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 shadow-sm"><p className="text-[11px] text-red-700 font-medium uppercase tracking-wide">Pengeluaran</p><p className="text-lg font-bold text-red-800 font-mono mt-0.5 leading-tight">{formatRupiah(summary.totalPengeluaran)}</p></div>
          </div>

          <div className={`border rounded-xl p-4 text-center shadow-sm ${summary.labaRugi >= 0 ? "bg-green-50 border-green-300" : "bg-red-50 border-red-300"}`}>
            <p className="text-sm font-semibold">{summary.labaRugi >= 0 ? "Laba Bersih" : "Rugi"}</p>
            <p className={`text-2xl font-bold font-mono mt-1 ${summary.labaRugi >= 0 ? "text-green-800" : "text-red-800"}`}>{formatRupiah(Math.abs(summary.labaRugi))}</p>
          </div>

          <div className="bg-white border border-border rounded-xl p-3.5 text-sm space-y-2 shadow-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Total Modal</span><span className="font-mono font-medium">{formatRupiah(summary.totalModal)}</span></div>
            <div className="border-t border-border pt-2 flex justify-between"><span className="text-muted-foreground">Saldo Kas Saat Ini</span><span className="font-mono font-bold text-primary">{formatRupiah(summary.saldoKas)}</span></div>
          </div>

          <div>
            <div className="flex border-b border-border mb-3">
              <button onClick={() => setDetailTab("penjualan")} className={`flex-1 py-2.5 text-[13px] font-semibold transition-colors ${detailTab === "penjualan" ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"}`}>Penjualan</button>
              <button onClick={() => setDetailTab("pembelanjaan")} className={`flex-1 py-2.5 text-[13px] font-semibold transition-colors ${detailTab === "pembelanjaan" ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"}`}>Pengeluaran</button>
            </div>
            {detailTab === "penjualan" ? (
              penjualan.length === 0 ? <p className="text-muted-foreground text-center py-6 text-sm">Belum ada penjualan di periode ini</p>
              : <div className="space-y-2">{penjualan.map((p) => (
                <div key={p.id} className="bg-white border border-border rounded-xl p-3 shadow-sm">
                  <div className="flex justify-between items-start">
                    <div className="min-w-0 flex-1 mr-2"><p className="font-medium text-[15px] truncate">{p.produkNama || p.produkId}</p><p className="text-xs text-muted-foreground mt-0.5">{p.qty} &times; {formatRupiah(p.hargaJual)} &middot; {p.metodeBayar === "CASH" ? "Tunai" : p.metodeBayar === "QRIS" ? "QRIS" : "Transfer"}</p></div>
                    <div className="text-right shrink-0"><p className="font-mono font-bold text-[15px]">{formatRupiah(p.total)}</p><p className="text-[11px] text-muted-foreground">{new Date(p.tanggal).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}</p></div>
                  </div>
                  {p.hargaDisesuaikan && <span className="inline-block mt-1.5 px-2 py-0.5 bg-amber-100 text-amber-700 text-[11px] rounded-full font-medium">Harga disesuaikan</span>}
                </div>
              ))}</div>
            ) : (
              pembelanjaan.length === 0 ? <p className="text-muted-foreground text-center py-6 text-sm">Belum ada pengeluaran di periode ini</p>
              : <div className="space-y-2">{pembelanjaan.map((p) => (
                <div key={p.id} className="bg-white border border-border rounded-xl p-3 shadow-sm">
                  <div className="flex justify-between items-start">
                    <div className="min-w-0 flex-1 mr-2"><p className="font-medium text-[15px] truncate">{p.namaBarang}</p>
                      <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-muted-foreground mt-0.5"><span className="text-[11px]">{p.kategori === "RESTOCK" ? "Restock" : p.kategori === "OPERASIONAL" ? "Operasional" : "Lainnya"}</span><span>{p.jumlah} &times; {formatRupiah(p.harga)}</span></div>
                    </div>
                    <div className="text-right shrink-0"><p className="font-mono font-bold text-[15px] text-red-600">{formatRupiah(p.total)}</p><p className="text-[11px] text-muted-foreground">{new Date(p.tanggal).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}</p></div>
                  </div>
                </div>
              ))}</div>
            )}
          </div>

          {perDay.length > 0 && (
            <div>
              <p className="text-sm font-semibold mb-2">Laba/Rugi Per Hari</p>
              <div className="bg-white border border-border rounded-xl shadow-sm overflow-hidden">
                <div className="grid grid-cols-4 gap-1 px-3 py-2 bg-muted text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                  <span>Tanggal</span>
                  <span className="text-right">Masuk</span>
                  <span className="text-right">Keluar</span>
                  <span className="text-right">Laba</span>
                </div>
                {perDay.map((d) => (
                  <div key={d.tanggal} className="grid grid-cols-4 gap-1 px-3 py-2 border-t border-border text-xs">
                    <span className="font-medium">{new Date(d.tanggal).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}</span>
                    <span className="text-right font-mono text-green-700">{d.pendapatan > 0 ? formatRupiah(d.pendapatan) : "-"}</span>
                    <span className="text-right font-mono text-red-600">{d.pengeluaran > 0 ? formatRupiah(d.pengeluaran) : "-"}</span>
                    <span className={`text-right font-mono font-semibold ${d.labaRugi >= 0 ? "text-green-700" : "text-red-600"}`}>{formatRupiah(d.labaRugi)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="pt-4 border-t border-border space-y-2">
            <button onClick={handleSeedDummy} className="w-full bg-amber-50 border border-amber-300 text-amber-800 py-2.5 rounded-lg text-sm font-medium hover:bg-amber-100 active:bg-amber-200 transition-colors">Buat Data Dummy (Testing)</button>
            <button onClick={handleResetAll} disabled={resetting} className="w-full bg-red-50 border border-red-300 text-red-700 py-2.5 rounded-lg text-sm font-medium hover:bg-red-100 active:bg-red-200 disabled:opacity-50 transition-colors">{resetting ? "Menghapus..." : "Reset Semua Data"}</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
