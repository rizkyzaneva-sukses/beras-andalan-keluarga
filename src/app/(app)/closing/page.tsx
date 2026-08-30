"use client";

import { useEffect, useState } from "react";

interface ClosingData {
  tanggal: string;
  penjualanCash: number;
  penjualanTransfer: number;
  penjualanQris: number;
  penjualanHutang: number;
  totalPendapatan: number;
  totalPengeluaran: number;
  labaRugi: number;
  totalModal: number;
  totalPiutang: number;
}

interface OmsetKasir {
  userId: string;
  username: string;
  role: string;
  cashTotal: number;
  transferTotal: number;
  qrisTotal: number;
  hutangTotal?: number;
  total: number;
  transaksi: number;
}

export default function ClosingPage() {
  const [data, setData] = useState<ClosingData | null>(null);
  const [omsetKasir, setOmsetKasir] = useState<OmsetKasir[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchClosing() {
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

      const [summaryRes, penjualanRes, pembelanjaanRes, omsetRes] = await Promise.all([
        fetch(`/api/laporan/summary?from=${today}&to=${today}`).then((r) => r.json()),
        fetch(`/api/penjualan?from=${today}&to=${today}`).then((r) => r.json()),
        fetch(`/api/pembelanjaan?from=${today}&to=${today}`).then((r) => r.json()),
        fetch(`/api/closing/per-kasir?from=${today}&to=${today}`).then((r) => r.json()),
      ]);
      setOmsetKasir(omsetRes.data || []);
      const penjualanList = penjualanRes.data || [];
      const cashTotal = penjualanList.filter((p: { metodeBayar: string }) => p.metodeBayar === "CASH").reduce((s: number, p: { total: number }) => s + p.total, 0);
      const transferTotal = penjualanList.filter((p: { metodeBayar: string }) => p.metodeBayar === "TRANSFER").reduce((s: number, p: { total: number }) => s + p.total, 0);
      const qrisTotal = penjualanList.filter((p: { metodeBayar: string }) => p.metodeBayar === "QRIS").reduce((s: number, p: { total: number }) => s + p.total, 0);
      const hutangTotal = penjualanList.filter((p: { metodeBayar: string }) => p.metodeBayar === "HUTANG").reduce((s: number, p: { total: number }) => s + p.total, 0);

      setData({
        tanggal: today,
        penjualanCash: cashTotal,
        penjualanTransfer: transferTotal,
        penjualanQris: qrisTotal,
        penjualanHutang: hutangTotal,
        totalPendapatan: summaryRes.totalPendapatan || 0,
        totalPengeluaran: summaryRes.totalPengeluaran || 0,
        labaRugi: summaryRes.labaRugi || 0,
        totalModal: summaryRes.totalModal || 0,
        totalPiutang: summaryRes.totalPiutang || 0,
      });
      setLoading(false);
    }
    fetchClosing();
  }, []);

  function formatRupiah(n: number) { return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n); }

  const tglIndo = new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="page-wrap space-y-4">
      <h2 className="text-lg font-bold">Closing Harian</h2>
      <p className="text-sm text-muted-foreground -mt-2">{tglIndo}</p>

      {loading ? (
        <div className="text-center py-10"><div className="inline-block w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /><p className="text-muted-foreground text-sm mt-2">Memuat...</p></div>
      ) : data ? (
        <div className="space-y-3">
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center shadow-sm">
            <p className="text-[11px] text-green-700 font-medium uppercase tracking-wide">Total Pendapatan Hari Ini</p>
            <p className="text-3xl font-bold text-green-800 font-mono mt-1">{formatRupiah(data.totalPendapatan)}</p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white border border-border rounded-xl p-3 shadow-sm">
              <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Tunai</p>
              <p className="text-base font-bold font-mono mt-0.5">{formatRupiah(data.penjualanCash)}</p>
            </div>
            <div className="bg-white border border-border rounded-xl p-3 shadow-sm">
              <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Transfer</p>
              <p className="text-base font-bold font-mono mt-0.5">{formatRupiah(data.penjualanTransfer)}</p>
            </div>
            <div className="bg-white border border-border rounded-xl p-3 shadow-sm">
              <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">QRIS</p>
              <p className="text-base font-bold font-mono mt-0.5">{formatRupiah(data.penjualanQris)}</p>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 shadow-sm">
              <p className="text-[10px] text-amber-800 font-medium uppercase tracking-wide">Hutang hari ini</p>
              <p className="text-base font-bold font-mono mt-0.5 text-amber-900">{formatRupiah(data.penjualanHutang)}</p>
            </div>
          </div>
          {data.totalPiutang > 0 && (
            <p className="text-xs text-amber-800">Masih ada hutang pelanggan belum lunas: {formatRupiah(data.totalPiutang)}</p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 shadow-sm">
              <p className="text-[11px] text-red-700 font-medium uppercase tracking-wide">Pengeluaran</p>
              <p className="text-lg font-bold text-red-800 font-mono mt-0.5">{formatRupiah(data.totalPengeluaran)}</p>
            </div>
            <div className={`border rounded-xl p-3 shadow-sm ${data.labaRugi >= 0 ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
              <p className={`text-[11px] font-medium uppercase tracking-wide ${data.labaRugi >= 0 ? "text-green-700" : "text-red-700"}`}>{data.labaRugi >= 0 ? "Laba/Rugi" : "Laba/Rugi"}</p>
              <p className={`text-lg font-bold font-mono mt-0.5 ${data.labaRugi >= 0 ? "text-green-800" : "text-red-800"}`}>{formatRupiah(data.labaRugi)}</p>
            </div>
          </div>

          <div className="bg-white border border-border rounded-xl p-3.5 space-y-2 shadow-sm text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Total Modal</span><span className="font-mono font-medium">{formatRupiah(data.totalModal)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Pendapatan</span><span className="font-mono font-medium text-green-700">+{formatRupiah(data.totalPendapatan)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Pengeluaran</span><span className="font-mono font-medium text-red-600">-{formatRupiah(data.totalPengeluaran)}</span></div>
            <div className="border-t border-border pt-2 flex justify-between"><span className="font-semibold">Saldo Kas Saat Ini</span><span className="font-mono font-bold text-primary text-[15px]">{formatRupiah(data.totalModal + data.totalPendapatan - data.totalPengeluaran)}</span></div>
          </div>

          {omsetKasir.length > 0 && (
            <div>
              <p className="text-sm font-semibold mb-2">Omset Per Kasir Hari Ini</p>
              <div className="space-y-2">
                {omsetKasir.map((u) => (
                  <div key={u.userId} className="bg-white border border-border rounded-xl p-3 shadow-sm">
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <p className="font-medium text-[15px]">{u.username}</p>
                        <p className="text-[11px] text-muted-foreground">{u.transaksi} transaksi · {u.role === "OWNER" ? "Pemilik" : "Kasir"}</p>
                      </div>
                      <p className="font-mono font-bold text-[15px]">{formatRupiah(u.total)}</p>
                    </div>
                    <div className="mt-2 grid grid-cols-4 gap-1.5 text-[11px]">
                      <div className="rounded-lg bg-muted px-2 py-1.5"><span className="text-muted-foreground">Tunai</span><p className="font-mono font-semibold">{u.cashTotal > 0 ? formatRupiah(u.cashTotal) : "—"}</p></div>
                      <div className="rounded-lg bg-muted px-2 py-1.5"><span className="text-muted-foreground">Transfer</span><p className="font-mono font-semibold">{u.transferTotal > 0 ? formatRupiah(u.transferTotal) : "—"}</p></div>
                      <div className="rounded-lg bg-muted px-2 py-1.5"><span className="text-muted-foreground">QRIS</span><p className="font-mono font-semibold">{u.qrisTotal > 0 ? formatRupiah(u.qrisTotal) : "—"}</p></div>
                      <div className="rounded-lg bg-amber-50 px-2 py-1.5"><span className="text-amber-800">Hutang</span><p className="font-mono font-semibold">{(u.hutangTotal ?? 0) > 0 ? formatRupiah(u.hutangTotal ?? 0) : "—"}</p></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
