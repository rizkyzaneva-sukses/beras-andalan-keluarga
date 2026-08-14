"use client";

import { useEffect, useState } from "react";
import { digitsOnly, formatRibuan, formatRupiah } from "@/lib/money";

interface UtangItem {
  id: string;
  tanggal: string;
  namaBarang: string;
  kategori: string;
  total: number;
  sudahDibayar: number;
}

interface PiutangItem {
  id: string;
  namaPelanggan: string;
  tanggal: string;
  total: number;
  sudahDibayar: number;
  item?: string;
}

type Tab = "pelanggan" | "toko";

export default function UtangPage() {
  const [role, setRole] = useState<"OWNER" | "KASIR" | null>(null);
  const [tab, setTab] = useState<Tab>("pelanggan");
  const [utang, setUtang] = useState<UtangItem[]>([]);
  const [piutang, setPiutang] = useState<PiutangItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [payId, setPayId] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMetode, setPayMetode] = useState<"CASH" | "TRANSFER" | "QRIS">("CASH");
  const [error, setError] = useState("");

  async function fetchAll(isOwner: boolean) {
    setLoading(true);
    const reqs: Promise<void>[] = [
      fetch("/api/piutang")
        .then((r) => r.json())
        .then((json) => {
          if (json.data) setPiutang(json.data);
        }),
    ];
    if (isOwner) {
      reqs.push(
        fetch("/api/utang")
          .then((r) => r.json())
          .then((json) => {
            if (json.data) setUtang(json.data);
          })
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
        fetchAll(isOwner);
      });
  }, []);

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
      fetchAll(true);
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
      fetchAll(role === "OWNER");
    } else setError(json.error || "Gagal");
  }

  const totalUtang = utang.reduce((s, u) => s + (u.total - u.sudahDibayar), 0);
  const totalPiutang = piutang.reduce((s, u) => s + (u.total - u.sudahDibayar), 0);
  const kategoriLabel: Record<string, string> = { RESTOCK: "Restock", OPERASIONAL: "Operasional", LAINNYA: "Lainnya" };
  const showToko = role === "OWNER";

  return (
    <div className="page-wrap space-y-4">
      <h2 className="text-lg font-bold">Utang & Hutang Pelanggan</h2>

      {showToko && (
        <div className="flex bg-muted rounded-xl p-1">
          <button
            type="button"
            onClick={() => {
              setTab("pelanggan");
              setPayId(null);
              setError("");
            }}
            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold ${tab === "pelanggan" ? "bg-white shadow-sm" : "text-muted-foreground"}`}
          >
            Hutang Pelanggan
          </button>
          <button
            type="button"
            onClick={() => {
              setTab("toko");
              setPayId(null);
              setError("");
            }}
            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold ${tab === "toko" ? "bg-white shadow-sm" : "text-muted-foreground"}`}
          >
            Utang Toko
          </button>
        </div>
      )}

      {tab === "pelanggan" ? (
        <>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center shadow-sm">
            <p className="text-xs text-amber-800 font-medium">Total Hutang Pelanggan Belum Lunas</p>
            <p className="text-2xl font-bold text-amber-900 font-mono mt-0.5">{formatRupiah(totalPiutang)}</p>
          </div>
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
              <p className="text-muted-foreground text-sm">Tidak ada hutang pelanggan</p>
            </div>
          ) : (
            <div className="space-y-2">
              {piutang.map((u) => {
                const sisa = u.total - u.sudahDibayar;
                const persen = Math.round((u.sudahDibayar / u.total) * 100);
                return (
                  <div key={u.id} className="bg-white border border-border rounded-xl p-3 shadow-sm">
                    <div className="flex justify-between items-start gap-2 mb-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-[15px]">{u.namaPelanggan}</p>
                        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground mt-0.5">
                          {u.item && <span className="truncate">{u.item}</span>}
                          <span>{new Date(u.tanggal).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}</span>
                        </div>
                      </div>
                      <span className="font-mono font-bold text-[15px] text-amber-700">{formatRupiah(sisa)}</span>
                    </div>
                    <div className="bg-muted rounded-lg h-2 mb-2 overflow-hidden">
                      <div className="bg-amber-500 h-full rounded-lg transition-all" style={{ width: `${persen}%` }} />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground mb-2">
                      <span>Dibayar: {formatRupiah(u.sudahDibayar)}</span>
                      <span>Total: {formatRupiah(u.total)}</span>
                    </div>
                    {payId === u.id ? (
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
                              placeholder={formatRupiah(sisa)}
                            />
                          </div>
                          <button onClick={handleBayarPiutang} className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium">
                            Bayar
                          </button>
                          <button
                            onClick={() => {
                              setPayId(null);
                              setPayAmount("");
                              setError("");
                            }}
                            className="text-muted-foreground text-sm"
                          >
                            Batal
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setPayId(u.id);
                          setPayAmount("");
                          setPayMetode("CASH");
                          setError("");
                        }}
                        className="text-primary text-sm font-medium hover:underline"
                      >
                        + Terima Pembayaran
                      </button>
                    )}
                    {payId === u.id && error && <p className="text-danger text-xs mt-1">{error}</p>}
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <>
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center shadow-sm">
            <p className="text-xs text-red-700 font-medium">Total Utang Toko Belum Lunas</p>
            <p className="text-2xl font-bold text-red-800 font-mono mt-0.5">{formatRupiah(totalUtang)}</p>
          </div>
          <p className="text-xs text-muted-foreground -mt-2">Utang ke supplier saat restock/pengeluaran berstatus Kredit.</p>

          {loading ? (
            <div className="text-center py-10">
              <div className="inline-block w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-muted-foreground text-sm mt-2">Memuat...</p>
            </div>
          ) : utang.length === 0 ? (
            <div className="text-center py-10 bg-white border border-dashed border-border rounded-xl">
              <p className="text-muted-foreground text-sm">Tidak ada utang toko</p>
            </div>
          ) : (
            <div className="space-y-2">
              {utang.map((u) => {
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
                    <div className="bg-muted rounded-lg h-2 mb-2 overflow-hidden">
                      <div className="bg-primary h-full rounded-lg transition-all" style={{ width: `${persen}%` }} />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground mb-2">
                      <span>Dibayar: {formatRupiah(u.sudahDibayar)}</span>
                      <span>Total: {formatRupiah(u.total)}</span>
                    </div>
                    {payId === u.id ? (
                      <div className="flex gap-2 items-end">
                        <div className="flex-1">
                          <label className="text-[11px] font-medium">Jumlah Bayar</label>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={formatRibuan(payAmount)}
                            onChange={(e) => setPayAmount(digitsOnly(e.target.value))}
                            className="w-full px-3 py-2 border border-border rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
                            placeholder={formatRupiah(sisa)}
                          />
                        </div>
                        <button onClick={handleBayarUtang} className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors">
                          Bayar
                        </button>
                        <button
                          onClick={() => {
                            setPayId(null);
                            setPayAmount("");
                            setError("");
                          }}
                          className="text-muted-foreground text-sm"
                        >
                          Batal
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setPayId(u.id);
                          setPayAmount("");
                          setError("");
                        }}
                        className="text-primary text-sm font-medium hover:underline"
                      >
                        + Bayar Utang
                      </button>
                    )}
                    {payId === u.id && error && <p className="text-danger text-xs mt-1">{error}</p>}
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
