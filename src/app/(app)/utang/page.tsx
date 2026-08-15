"use client";

import { useEffect, useState } from "react";
import { digitsOnly, formatRibuan, formatRupiah } from "@/lib/money";

/* ---------- types ---------- */
interface BayarItem {
  id: string;
  jumlah: number;
  tanggal: string;
  metode?: string;
  oleh: string;
}

interface UtangItem {
  id: string;
  tanggal: string;
  namaBarang: string;
  kategori: string;
  total: number;
  sudahDibayar: number;
  sisa: number;
  lunas: boolean;
  pembayaran: BayarItem[];
}

interface PiutangItem {
  id: string;
  namaPelanggan: string;
  tanggal: string;
  total: number;
  sudahDibayar: number;
  sisa: number;
  lunas: boolean;
  item?: string;
  keterangan?: string;
  pembayaran: BayarItem[];
}

type Tab = "pelanggan" | "toko";
type StatusFilter = "semua" | "belum_lunas" | "lunas";

const STATUS_LABELS: Record<StatusFilter, string> = {
  semua: "Semua",
  belum_lunas: "Belum Lunas",
  lunas: "Lunas",
};

const kategoriLabel: Record<string, string> = {
  RESTOCK: "Restock",
  OPERASIONAL: "Operasional",
  LAINNYA: "Lainnya",
};

/* ---------- component ---------- */
export default function UtangPage() {
  const [role, setRole] = useState<"OWNER" | "KASIR" | null>(null);
  const [tab, setTab] = useState<Tab>("pelanggan");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("belum_lunas");
  const [utang, setUtang] = useState<UtangItem[]>([]);
  const [piutang, setPiutang] = useState<PiutangItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [payId, setPayId] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMetode, setPayMetode] = useState<"CASH" | "TRANSFER" | "QRIS">("CASH");
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  /* ---- fetch ---- */
  async function fetchAll(isOwner: boolean, filter: StatusFilter) {
    setLoading(true);
    const reqs: Promise<void>[] = [
      fetch(`/api/piutang?status=${filter}`)
        .then((r) => r.json())
        .then((json) => {
          if (json.data) setPiutang(json.data);
        }),
    ];
    if (isOwner) {
      reqs.push(
        fetch(`/api/utang?status=${filter}`)
          .then((r) => r.json())
          .then((json) => {
            if (json.data) setUtang(json.data);
          }),
      );
    }
    await Promise.all(reqs);
    setLoading(false);
  }

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        const isOwner = data.user?.role === "OWNER";
        setRole(isOwner ? "OWNER" : "KASIR");
        setTab("pelanggan");
        fetchAll(isOwner, statusFilter);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (role) fetchAll(role === "OWNER", statusFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  /* ---- pay handlers ---- */
  async function handleBayarUtang() {
    if (!payId || !payAmount) return;
    setError("");
    const res = await fetch("/api/utang/bayar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pembelanjaanId: payId, jumlah: Number(digitsOnly(payAmount)) }),
    });
    const json = await res.json();
    if (res.ok) {
      setPayId(null);
      setPayAmount("");
      fetchAll(true, statusFilter);
    } else setError(json.error || "Gagal");
  }

  async function handleBayarPiutang() {
    if (!payId || !payAmount) return;
    setError("");
    const res = await fetch("/api/piutang/bayar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        piutangId: payId,
        jumlah: Number(digitsOnly(payAmount)),
        metodeBayar: payMetode,
      }),
    });
    const json = await res.json();
    if (res.ok) {
      setPayId(null);
      setPayAmount("");
      setPayMetode("CASH");
      fetchAll(role === "OWNER", statusFilter);
    } else setError(json.error || "Gagal");
  }

  /* ---- derived ---- */
  const totalBelumLunasPiutang = piutang.filter((p) => !p.lunas).reduce((s, u) => s + u.sisa, 0);
  const totalBelumLunasUtang = utang.filter((u) => !u.lunas).reduce((s, u) => s + u.sisa, 0);
  const showToko = role === "OWNER";

  /* ---- badge helper ---- */
  function StatusBadge({ lunas }: { lunas: boolean }) {
    return lunas ? (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
        ✓ Lunas
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
        ● Belum Lunas
      </span>
    );
  }

  /* ---- payment history accordion ---- */
  function PaymentHistory({ payments, type }: { payments: BayarItem[]; type: "utang" | "piutang" }) {
    if (payments.length === 0) return null;
    return (
      <div className="mt-2 border-t border-border pt-2">
        <p className="text-[11px] font-semibold text-muted-foreground mb-1.5">Riwayat Pembayaran</p>
        <div className="space-y-1">
          {payments.map((b) => (
            <div key={b.id} className="flex justify-between items-center text-xs bg-muted/50 rounded-lg px-2.5 py-1.5">
              <div className="min-w-0">
                <span className="text-foreground font-medium">{formatRupiah(b.jumlah)}</span>
                {type === "piutang" && b.metode && (
                  <span className="ml-1.5 text-[10px] bg-muted px-1.5 py-0.5 rounded font-medium">{b.metode}</span>
                )}
              </div>
              <div className="text-right shrink-0 ml-2">
                <span className="text-muted-foreground">{new Date(b.tanggal).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "2-digit" })}</span>
                <span className="ml-1.5 text-muted-foreground/70">oleh {b.oleh}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  /* ---- render ---- */
  return (
    <div className="page-wrap space-y-4">
      <h2 className="text-lg font-bold">Utang & Hutang Pelanggan</h2>

      {/* tab: pelanggan / toko */}
      {showToko && (
        <div className="flex bg-muted rounded-xl p-1">
          <button
            type="button"
            onClick={() => { setTab("pelanggan"); setPayId(null); setError(""); }}
            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold ${tab === "pelanggan" ? "bg-white shadow-sm" : "text-muted-foreground"}`}
          >
            Hutang Pelanggan
          </button>
          <button
            type="button"
            onClick={() => { setTab("toko"); setPayId(null); setError(""); }}
            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold ${tab === "toko" ? "bg-white shadow-sm" : "text-muted-foreground"}`}
          >
            Utang Toko
          </button>
        </div>
      )}

      {/* filter: semua / belum lunas / lunas */}
      <div className="flex gap-1.5">
        {(Object.keys(STATUS_LABELS) as StatusFilter[]).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => { setStatusFilter(s); setPayId(null); setExpandedId(null); setError(""); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              statusFilter === s
                ? s === "belum_lunas"
                  ? "bg-amber-500 text-white"
                  : s === "lunas"
                    ? "bg-emerald-500 text-white"
                    : "bg-primary text-white"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {STATUS_LABELS[s]}
            {s === "belum_lunas" && (
              <span className="ml-1 opacity-80">
                ({tab === "pelanggan" ? piutang.filter((p) => !p.lunas).length : utang.filter((u) => !u.lunas).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ======= PELANGGAN TAB ======= */}
      {tab === "pelanggan" ? (
        <>
          {statusFilter === "belum_lunas" && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center shadow-sm">
              <p className="text-xs text-amber-800 font-medium">Total Hutang Pelanggan Belum Lunas</p>
              <p className="text-2xl font-bold text-amber-900 font-mono mt-0.5">{formatRupiah(totalBelumLunasPiutang)}</p>
            </div>
          )}

          <p className="text-xs text-muted-foreground -mt-2">
            Catat belanja hutang di POS (metode Hutang). Di sini catat ketika pelanggan membayar belakangan.
          </p>

          {loading ? (
            <div className="text-center py-10">
              <div className="inline-block w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-muted-foreground text-sm mt-2">Memuat...</p>
            </div>
          ) : piutang.length === 0 ? (
            <div className="text-center py-10 bg-white border border-dashed border-border rounded-xl">
              <p className="text-muted-foreground text-sm">
                {statusFilter === "lunas" ? "Belum ada hutang pelanggan yang lunas" : statusFilter === "belum_lunas" ? "Tidak ada hutang pelanggan yang belum lunas" : "Tidak ada hutang pelanggan"}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {piutang.map((u) => {
                const persen = Math.round((u.sudahDibayar / u.total) * 100);
                const expanded = expandedId === u.id;
                return (
                  <div key={u.id} className={`bg-white border rounded-xl p-3 shadow-sm ${u.lunas ? "border-emerald-200" : "border-border"}`}>
                    <div className="flex justify-between items-start gap-2 mb-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-[15px]">{u.namaPelanggan}</p>
                          <StatusBadge lunas={u.lunas} />
                        </div>
                        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground mt-0.5">
                          {u.item && <span className="truncate">{u.item}</span>}
                          <span>{new Date(u.tanggal).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</span>
                        </div>
                      </div>
                      <span className={`font-mono font-bold text-[15px] ${u.lunas ? "text-emerald-600" : "text-amber-700"}`}>
                        {u.lunas ? "Lunas" : formatRupiah(u.sisa)}
                      </span>
                    </div>

                    <div className="bg-muted rounded-lg h-2 mb-2 overflow-hidden">
                      <div className={`h-full rounded-lg transition-all ${u.lunas ? "bg-emerald-500" : "bg-amber-500"}`} style={{ width: `${Math.min(persen, 100)}%` }} />
                    </div>

                    <div className="flex justify-between text-xs text-muted-foreground mb-2">
                      <span>Dibayar: {formatRupiah(u.sudahDibayar)}</span>
                      <span>Total: {formatRupiah(u.total)}</span>
                    </div>

                    {/* action buttons */}
                    {!u.lunas && payId === u.id ? (
                      <div className="space-y-2">
                        <div className="grid grid-cols-3 gap-1.5">
                          {(["CASH", "TRANSFER", "QRIS"] as const).map((m) => (
                            <button
                              key={m}
                              type="button"
                              onClick={() => setPayMetode(m)}
                              className={`py-2 rounded-lg text-xs font-semibold ${payMetode === m ? "bg-primary text-white" : "bg-muted text-muted-foreground"}`}
                            >
                              {m === "CASH" ? "Tunai" : m}
                            </button>
                          ))}
                        </div>
                        <div className="flex gap-2 items-end">
                          <div className="flex-1">
                            <label className="text-[11px] font-medium">Jumlah Bayar</label>
                            <input
                              type="text"
                              inputMode="numeric"
                              value={formatRibuan(payAmount)}
                              onChange={(e) => setPayAmount(digitsOnly(e.target.value))}
                              className="w-full px-3 py-2 border border-border rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
                              placeholder={formatRupiah(u.sisa)}
                            />
                          </div>
                          <button onClick={handleBayarPiutang} className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium">
                            Bayar
                          </button>
                          <button
                            onClick={() => { setPayId(null); setPayAmount(""); setError(""); }}
                            className="text-muted-foreground text-sm"
                          >
                            Batal
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        {!u.lunas && (
                          <button
                            onClick={() => { setPayId(u.id); setPayAmount(""); setPayMetode("CASH"); setError(""); }}
                            className="text-primary text-sm font-medium hover:underline"
                          >
                            + Terima Pembayaran
                          </button>
                        )}
                        {u.pembayaran.length > 0 && (
                          <button
                            onClick={() => setExpandedId(expanded ? null : u.id)}
                            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                          >
                            {expanded ? "▾ Sembunyikan" : "▸ Riwayat"} ({u.pembayaran.length})
                          </button>
                        )}
                      </div>
                    )}
                    {payId === u.id && error && <p className="text-danger text-xs mt-1">{error}</p>}

                    {/* payment history */}
                    {expanded && <PaymentHistory payments={u.pembayaran} type="piutang" />}
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : (
        /* ======= TOKO TAB ======= */
        <>
          {statusFilter === "belum_lunas" && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center shadow-sm">
              <p className="text-xs text-red-700 font-medium">Total Utang Toko Belum Lunas</p>
              <p className="text-2xl font-bold text-red-800 font-mono mt-0.5">{formatRupiah(totalBelumLunasUtang)}</p>
            </div>
          )}

          <p className="text-xs text-muted-foreground -mt-2">Utang ke supplier saat restock/pengeluaran berstatus Kredit.</p>

          {loading ? (
            <div className="text-center py-10">
              <div className="inline-block w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-muted-foreground text-sm mt-2">Memuat...</p>
            </div>
          ) : utang.length === 0 ? (
            <div className="text-center py-10 bg-white border border-dashed border-border rounded-xl">
              <p className="text-muted-foreground text-sm">
                {statusFilter === "lunas" ? "Belum ada utang toko yang lunas" : statusFilter === "belum_lunas" ? "Tidak ada utang toko yang belum lunas" : "Tidak ada utang toko"}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {utang.map((u) => {
                const persen = Math.round((u.sudahDibayar / u.total) * 100);
                const expanded = expandedId === u.id;
                return (
                  <div key={u.id} className={`bg-white border rounded-xl p-3 shadow-sm ${u.lunas ? "border-emerald-200" : "border-border"}`}>
                    <div className="flex justify-between items-start gap-2 mb-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-[15px]">{u.namaBarang}</p>
                          <StatusBadge lunas={u.lunas} />
                        </div>
                        <div className="flex gap-2 text-xs text-muted-foreground mt-0.5">
                          <span>{kategoriLabel[u.kategori] || u.kategori}</span>
                          <span>{new Date(u.tanggal).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</span>
                        </div>
                      </div>
                      <span className={`font-mono font-bold text-[15px] ${u.lunas ? "text-emerald-600" : "text-red-600"}`}>
                        {u.lunas ? "Lunas" : formatRupiah(u.sisa)}
                      </span>
                    </div>

                    <div className="bg-muted rounded-lg h-2 mb-2 overflow-hidden">
                      <div className={`h-full rounded-lg transition-all ${u.lunas ? "bg-emerald-500" : "bg-primary"}`} style={{ width: `${Math.min(persen, 100)}%` }} />
                    </div>

                    <div className="flex justify-between text-xs text-muted-foreground mb-2">
                      <span>Dibayar: {formatRupiah(u.sudahDibayar)}</span>
                      <span>Total: {formatRupiah(u.total)}</span>
                    </div>

                    {/* action buttons */}
                    {!u.lunas && payId === u.id ? (
                      <div className="flex gap-2 items-end">
                        <div className="flex-1">
                          <label className="text-[11px] font-medium">Jumlah Bayar</label>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={formatRibuan(payAmount)}
                            onChange={(e) => setPayAmount(digitsOnly(e.target.value))}
                            className="w-full px-3 py-2 border border-border rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
                            placeholder={formatRupiah(u.sisa)}
                          />
                        </div>
                        <button onClick={handleBayarUtang} className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors">
                          Bayar
                        </button>
                        <button
                          onClick={() => { setPayId(null); setPayAmount(""); setError(""); }}
                          className="text-muted-foreground text-sm"
                        >
                          Batal
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        {!u.lunas && (
                          <button
                            onClick={() => { setPayId(u.id); setPayAmount(""); setError(""); }}
                            className="text-primary text-sm font-medium hover:underline"
                          >
                            + Bayar Utang
                          </button>
                        )}
                        {u.pembayaran.length > 0 && (
                          <button
                            onClick={() => setExpandedId(expanded ? null : u.id)}
                            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                          >
                            {expanded ? "▾ Sembunyikan" : "▸ Riwayat"} ({u.pembayaran.length})
                          </button>
                        )}
                      </div>
                    )}
                    {payId === u.id && error && <p className="text-danger text-xs mt-1">{error}</p>}

                    {/* payment history */}
                    {expanded && <PaymentHistory payments={u.pembayaran} type="utang" />}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
