"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { LaporanSummary, OmsetPerUser, PenjualanEntry, PembelanjaanEntry } from "@/types";

type RangeKey = "today" | "week" | "month" | "custom";

interface PerDayEntry {
  tanggal: string;
  pendapatan: number;
  pengeluaran: number;
  labaRugi: number;
}

const PAGE_SIZE = 8;
const DAY_PAGE_SIZE = 7;

function formatRupiah(n: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);
}

function metodeLabel(m: string) {
  if (m === "CASH") return "Tunai";
  if (m === "QRIS") return "QRIS";
  return "Transfer";
}

function Pagination({
  page,
  total,
  pageSize,
  onChange,
}: {
  page: number;
  total: number;
  pageSize: number;
  onChange: (page: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const pages: number[] = [];
  const windowStart = Math.max(1, page - 2);
  const windowEnd = Math.min(totalPages, windowStart + 4);
  for (let i = windowEnd - Math.min(4, totalPages - 1); i <= windowEnd; i++) {
    if (i >= 1) pages.push(i);
  }

  return (
    <div className="flex items-center justify-between gap-2 pt-1">
      <p className="text-[11px] text-muted-foreground">
        {from}–{to} dari {total}
      </p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          className="min-w-[36px] h-9 px-2 rounded-lg text-sm font-semibold border border-border bg-surface disabled:opacity-40 hover:bg-muted"
        >
          ‹
        </button>
        {pages.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onChange(p)}
            className={`min-w-[36px] h-9 px-2 rounded-lg text-[13px] font-semibold ${
              p === page ? "bg-primary text-white" : "border border-border bg-surface text-muted-foreground hover:bg-muted"
            }`}
          >
            {p}
          </button>
        ))}
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onChange(page + 1)}
          className="min-w-[36px] h-9 px-2 rounded-lg text-sm font-semibold border border-border bg-surface disabled:opacity-40 hover:bg-muted"
        >
          ›
        </button>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [range, setRange] = useState<RangeKey>("today");
  const [dateFrom, setDateFrom] = useState(new Date().toISOString().slice(0, 10));
  const [dateTo, setDateTo] = useState(new Date().toISOString().slice(0, 10));
  const [summary, setSummary] = useState<LaporanSummary | null>(null);
  const [penjualan, setPenjualan] = useState<PenjualanEntry[]>([]);
  const [pembelanjaan, setPembelanjaan] = useState<PembelanjaanEntry[]>([]);
  const [perDay, setPerDay] = useState<PerDayEntry[]>([]);
  const [omsetUsers, setOmsetUsers] = useState<OmsetPerUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailTab, setDetailTab] = useState<"penjualan" | "pembelanjaan">("penjualan");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [salePage, setSalePage] = useState(1);
  const [spendPage, setSpendPage] = useState(1);
  const [dayPage, setDayPage] = useState(1);
  const [resetting, setResetting] = useState(false);

  function getRangeDates(): { from: string; to: string } {
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    if (range === "today") return { from: todayStr, to: todayStr };
    if (range === "week") {
      const start = new Date(today);
      start.setDate(today.getDate() - today.getDay());
      return { from: start.toISOString().slice(0, 10), to: todayStr };
    }
    if (range === "month") {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      return { from: start.toISOString().slice(0, 10), to: todayStr };
    }
    return { from: dateFrom, to: dateTo };
  }

  const fetchData = useCallback(async () => {
    const { from, to } = getRangeDates();
    setLoading(true);
    const [summaryRes, penjualanRes, pembelanjaanRes, perDayRes, omsetRes] = await Promise.all([
      fetch(`/api/laporan/summary?from=${from}&to=${to}`).then((r) => r.json()),
      fetch(`/api/penjualan?from=${from}&to=${to}`).then((r) => r.json()),
      fetch(`/api/pembelanjaan?from=${from}&to=${to}`).then((r) => r.json()),
      fetch(`/api/laporan/per-hari?from=${from}&to=${to}`).then((r) => r.json()),
      fetch(`/api/closing/per-kasir?from=${from}&to=${to}`).then((r) => r.json()),
    ]);
    setSummary(summaryRes);
    setPenjualan(penjualanRes.data || []);
    setPembelanjaan(pembelanjaanRes.data || []);
    setPerDay(perDayRes.data || []);
    setOmsetUsers(omsetRes.data || []);
    setSelectedUserId(null);
    setSalePage(1);
    setSpendPage(1);
    setDayPage(1);
    setLoading(false);
  }, [range, dateFrom, dateTo]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleSeedDummy() {
    if (!confirm("Buat data dummy? Ini akan menambah transaksi contoh untuk testing.")) return;
    const res = await fetch("/api/seed-dummy", { method: "POST" });
    const data = await res.json();
    if (data.success) {
      alert(data.message);
      fetchData();
    } else {
      alert("Gagal: " + data.error);
    }
  }

  async function handleResetAll() {
    if (!confirm("HAPUS SEMUA DATA? Semua transaksi, produk, modal, dan user (kecuali admin) akan dihapus permanen. Lanjutkan?")) return;
    setResetting(true);
    const res = await fetch("/api/reset", { method: "POST" });
    const data = await res.json();
    setResetting(false);
    if (data.success) {
      alert(data.message);
      window.location.reload();
    } else {
      alert("Gagal: " + data.error);
    }
  }

  const filteredPenjualan = useMemo(
    () => (selectedUserId ? penjualan.filter((p) => p.createdBy === selectedUserId) : penjualan),
    [penjualan, selectedUserId],
  );

  const pagedPenjualan = useMemo(() => {
    const start = (salePage - 1) * PAGE_SIZE;
    return filteredPenjualan.slice(start, start + PAGE_SIZE);
  }, [filteredPenjualan, salePage]);

  const pagedPembelanjaan = useMemo(() => {
    const start = (spendPage - 1) * PAGE_SIZE;
    return pembelanjaan.slice(start, start + PAGE_SIZE);
  }, [pembelanjaan, spendPage]);

  const pagedPerDay = useMemo(() => {
    const start = (dayPage - 1) * DAY_PAGE_SIZE;
    return perDay.slice(start, start + DAY_PAGE_SIZE);
  }, [perDay, dayPage]);

  const selectedUser = omsetUsers.find((u) => u.userId === selectedUserId) || null;
  const rangeLabels: Record<RangeKey, string> = { today: "Hari Ini", week: "Minggu Ini", month: "Bulan Ini", custom: "Custom" };

  return (
    <div className="page-wrap space-y-4">
      <div>
        <h2 className="text-xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Ringkasan kas & laba/rugi</p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {(Object.keys(rangeLabels) as RangeKey[]).map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={`px-3.5 py-2.5 rounded-xl text-[13px] font-semibold transition-colors min-h-[40px] ${
              range === r ? "bg-primary text-white shadow-sm" : "bg-surface border border-border text-muted-foreground hover:bg-muted active:bg-border"
            }`}
          >
            {rangeLabels[r]}
          </button>
        ))}
      </div>

      {range === "custom" && (
        <div className="flex gap-2 items-center">
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="input-field text-sm flex-1" />
          <span className="text-muted-foreground text-sm">s/d</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="input-field text-sm flex-1" />
        </div>
      )}

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block w-8 h-8 border-[3px] border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground text-sm mt-3">Memuat data...</p>
        </div>
      ) : summary ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="card-surface p-4 bg-primary-soft/40 border-primary/15">
              <p className="text-[11px] text-primary font-semibold uppercase tracking-wide">Pendapatan</p>
              <p className="text-lg font-bold text-primary font-mono mt-1 leading-tight">{formatRupiah(summary.totalPendapatan)}</p>
            </div>
            <div className="card-surface p-4 bg-danger-soft/50 border-danger/15">
              <p className="text-[11px] text-danger font-semibold uppercase tracking-wide">Pengeluaran</p>
              <p className="text-lg font-bold text-danger font-mono mt-1 leading-tight">{formatRupiah(summary.totalPengeluaran)}</p>
            </div>
            <div className={`card-surface p-4 col-span-2 lg:col-span-1 ${summary.labaRugi >= 0 ? "bg-primary-soft/30 border-primary/20" : "bg-danger-soft/40 border-danger/20"}`}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{summary.labaRugi >= 0 ? "Laba Bersih" : "Rugi"}</p>
              <p className={`text-xl font-bold font-mono mt-1 ${summary.labaRugi >= 0 ? "text-primary" : "text-danger"}`}>{formatRupiah(Math.abs(summary.labaRugi))}</p>
            </div>
            <div className="card-surface p-4 col-span-2 lg:col-span-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Saldo Kas</p>
              <p className="text-xl font-bold font-mono mt-1 text-foreground">{formatRupiah(summary.saldoKas)}</p>
              <p className="text-xs text-muted-foreground mt-1">Modal {formatRupiah(summary.totalModal)}</p>
            </div>
          </div>

          <div>
            <div className="flex items-end justify-between gap-2 mb-2">
              <div>
                <p className="text-sm font-semibold">Omset Per Kasir</p>
                <p className="text-[11px] text-muted-foreground">Ketuk nama untuk lihat transaksi orang itu</p>
              </div>
              {selectedUserId && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedUserId(null);
                    setSalePage(1);
                    setDetailTab("penjualan");
                  }}
                  className="text-[12px] font-semibold text-primary hover:underline"
                >
                  Tampilkan semua
                </button>
              )}
            </div>
            {omsetUsers.length === 0 ? (
              <p className="text-muted-foreground text-center py-6 text-sm">Belum ada user aktif</p>
            ) : (
              <div className="space-y-2">
                {omsetUsers.map((u) => {
                  const active = selectedUserId === u.userId;
                  return (
                    <button
                      key={u.userId}
                      type="button"
                      onClick={() => {
                        setSelectedUserId(active ? null : u.userId);
                        setSalePage(1);
                        setDetailTab("penjualan");
                      }}
                      className={`w-full text-left card-surface p-3 transition-colors ${
                        active ? "border-primary bg-primary-soft/40 ring-1 ring-primary/30" : "hover:bg-muted/60"
                      }`}
                    >
                      <div className="flex justify-between items-start gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="font-semibold text-[15px] truncate">{u.username}</p>
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${u.role === "OWNER" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                              {u.role === "OWNER" ? "Pemilik" : "Kasir"}
                            </span>
                            {!u.isActive && <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-100 text-red-600">Nonaktif</span>}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {u.transaksi} transaksi · {u.qty} item
                          </p>
                        </div>
                        <p className="font-mono font-bold text-[15px] shrink-0">{formatRupiah(u.total)}</p>
                      </div>
                      <div className="mt-2 grid grid-cols-3 gap-1.5">
                        <div className="rounded-lg bg-muted/80 px-2 py-1.5">
                          <p className="text-[10px] text-muted-foreground font-medium">Tunai</p>
                          <p className="font-mono text-[12px] font-semibold">{u.cashTotal > 0 ? formatRupiah(u.cashTotal) : "—"}</p>
                        </div>
                        <div className="rounded-lg bg-muted/80 px-2 py-1.5">
                          <p className="text-[10px] text-muted-foreground font-medium">Transfer</p>
                          <p className="font-mono text-[12px] font-semibold">{u.transferTotal > 0 ? formatRupiah(u.transferTotal) : "—"}</p>
                        </div>
                        <div className="rounded-lg bg-muted/80 px-2 py-1.5">
                          <p className="text-[10px] text-muted-foreground font-medium">QRIS</p>
                          <p className="font-mono text-[12px] font-semibold">{u.qrisTotal > 0 ? formatRupiah(u.qrisTotal) : "—"}</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <div className="flex border-b border-border mb-3">
              <button
                onClick={() => setDetailTab("penjualan")}
                className={`flex-1 py-2.5 text-[13px] font-semibold transition-colors ${detailTab === "penjualan" ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"}`}
              >
                Penjualan{selectedUser ? ` · ${selectedUser.username}` : ""}
              </button>
              <button
                onClick={() => setDetailTab("pembelanjaan")}
                className={`flex-1 py-2.5 text-[13px] font-semibold transition-colors ${detailTab === "pembelanjaan" ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"}`}
              >
                Pengeluaran
              </button>
            </div>
            {detailTab === "penjualan" ? (
              filteredPenjualan.length === 0 ? (
                <p className="text-muted-foreground text-center py-6 text-sm">
                  {selectedUser ? `Belum ada penjualan ${selectedUser.username} di periode ini` : "Belum ada penjualan di periode ini"}
                </p>
              ) : (
                <div className="space-y-2">
                  {pagedPenjualan.map((p) => (
                    <div key={p.id} className="card-surface p-3">
                      <div className="flex justify-between items-start">
                        <div className="min-w-0 flex-1 mr-2">
                          <p className="font-medium text-[15px] truncate">{p.produkNama || p.produkId}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {p.qty} &times; {formatRupiah(p.hargaJual)} &middot; {metodeLabel(p.metodeBayar)}
                            {p.createdByUsername ? ` · ${p.createdByUsername}` : ""}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-mono font-bold text-[15px]">{formatRupiah(p.total)}</p>
                          <p className="text-[11px] text-muted-foreground">{new Date(p.tanggal).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}</p>
                        </div>
                      </div>
                      {p.hargaDisesuaikan && <span className="inline-block mt-1.5 px-2 py-0.5 bg-amber-100 text-amber-700 text-[11px] rounded-full font-medium">Harga disesuaikan</span>}
                    </div>
                  ))}
                  <Pagination page={salePage} total={filteredPenjualan.length} pageSize={PAGE_SIZE} onChange={setSalePage} />
                </div>
              )
            ) : pembelanjaan.length === 0 ? (
              <p className="text-muted-foreground text-center py-6 text-sm">Belum ada pengeluaran di periode ini</p>
            ) : (
              <div className="space-y-2">
                {pagedPembelanjaan.map((p) => (
                  <div key={p.id} className="card-surface p-3">
                    <div className="flex justify-between items-start">
                      <div className="min-w-0 flex-1 mr-2">
                        <p className="font-medium text-[15px] truncate">{p.namaBarang}</p>
                        <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-muted-foreground mt-0.5">
                          <span className="text-[11px]">{p.kategori === "RESTOCK" ? "Restock" : p.kategori === "OPERASIONAL" ? "Operasional" : "Lainnya"}</span>
                          <span>
                            {p.jumlah} &times; {formatRupiah(p.harga)}
                          </span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-mono font-bold text-[15px] text-red-600">{formatRupiah(p.total)}</p>
                        <p className="text-[11px] text-muted-foreground">{new Date(p.tanggal).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}</p>
                      </div>
                    </div>
                  </div>
                ))}
                <Pagination page={spendPage} total={pembelanjaan.length} pageSize={PAGE_SIZE} onChange={setSpendPage} />
              </div>
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
                {pagedPerDay.map((d) => (
                  <div key={d.tanggal} className="grid grid-cols-4 gap-1 px-3 py-2 border-t border-border text-xs">
                    <span className="font-medium">{new Date(d.tanggal).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}</span>
                    <span className="text-right font-mono text-green-700">{d.pendapatan > 0 ? formatRupiah(d.pendapatan) : "-"}</span>
                    <span className="text-right font-mono text-red-600">{d.pengeluaran > 0 ? formatRupiah(d.pengeluaran) : "-"}</span>
                    <span className={`text-right font-mono font-semibold ${d.labaRugi >= 0 ? "text-green-700" : "text-red-600"}`}>{formatRupiah(d.labaRugi)}</span>
                  </div>
                ))}
              </div>
              <div className="mt-2">
                <Pagination page={dayPage} total={perDay.length} pageSize={DAY_PAGE_SIZE} onChange={setDayPage} />
              </div>
            </div>
          )}

          <div className="pt-4 border-t border-border space-y-2">
            <button onClick={handleSeedDummy} className="w-full bg-amber-50 border border-amber-300 text-amber-800 py-2.5 rounded-lg text-sm font-medium hover:bg-amber-100 active:bg-amber-200 transition-colors">
              Buat Data Dummy (Testing)
            </button>
            <button
              onClick={handleResetAll}
              disabled={resetting}
              className="w-full bg-red-50 border border-red-300 text-red-700 py-2.5 rounded-lg text-sm font-medium hover:bg-red-100 active:bg-red-200 disabled:opacity-50 transition-colors"
            >
              {resetting ? "Menghapus..." : "Reset Semua Data"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
