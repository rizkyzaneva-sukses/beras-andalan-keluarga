"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";

interface Produk {
  id: string;
  nama: string;
  hargaJual: number;
}

interface CartItem {
  produkId: string;
  nama: string;
  hargaJual: number;
  qty: number;
}

const rupiah = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);

export default function PosPage() {
  const [produk, setProduk] = useState<Produk[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showScanner, setShowScanner] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [metodeBayar, setMetodeBayar] = useState<"CASH" | "QRIS" | "TRANSFER" | null>(null);
  const [uangDiterima, setUangDiterima] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [paying, setPaying] = useState(false);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    fetch("/api/produk")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setProduk(data);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (showScanner) {
      scannerRef.current = new Html5QrcodeScanner(
        "reader",
        { fps: 10, qrbox: { width: 250, height: 150 }, supportedScanTypes: [] },
        false
      );
      scannerRef.current.render(onScanSuccess, onScanError);
    }
    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(() => {});
      }
    };
  }, [showScanner]);

  const onScanSuccess = useCallback(
    (decodedText: string) => {
      const product = produk.find((p) => p.id === decodedText);
      if (product) addToCart(product);
      if (scannerRef.current) scannerRef.current.clear().catch(() => {});
      setShowScanner(false);
    },
    [produk]
  );

  const onScanError = useCallback(() => {}, []);

  const addToCart = (product: Produk) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.produkId === product.id);
      if (existing)
        return prev.map((item) =>
          item.produkId === product.id ? { ...item, qty: item.qty + 1 } : item
        );
      return [
        ...prev,
        { produkId: product.id, nama: product.nama, hargaJual: product.hargaJual, qty: 1 },
      ];
    });
  };

  const changeQty = (produkId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => (item.produkId === produkId ? { ...item, qty: item.qty + delta } : item))
        .filter((item) => item.qty > 0)
    );
  };

  const removeItem = (produkId: string) =>
    setCart((prev) => prev.filter((item) => item.produkId !== produkId));

  const total = cart.reduce((sum, item) => sum + item.hargaJual * item.qty, 0);
  const kembalian = uangDiterima ? Number(uangDiterima) - total : 0;
  const canBayar =
    cart.length > 0 &&
    metodeBayar !== null &&
    !paying &&
    (metodeBayar !== "CASH" || (uangDiterima && Number(uangDiterima) >= total));

  const checkout = async () => {
    if (!canBayar || !metodeBayar) return;
    setPaying(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      for (const item of cart) {
        await fetch("/api/penjualan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tanggal: today,
            produkId: item.produkId,
            qty: item.qty,
            hargaJual: item.hargaJual,
            total: item.hargaJual * item.qty,
            metodeBayar,
            hargaDisesuaikan: false,
          }),
        });
      }
      setCart([]);
      setMetodeBayar(null);
      setUangDiterima("");
      setSuccessMsg("Pembayaran berhasil!");
      setTimeout(() => setSuccessMsg(""), 2500);
    } finally {
      setPaying(false);
    }
  };

  const filtered = searchQuery
    ? produk.filter((p) => p.nama.toLowerCase().includes(searchQuery.toLowerCase()))
    : produk;

  return (
    <div className="page-wrap space-y-4 lg:space-y-0 lg:grid lg:grid-cols-5 lg:gap-6 lg:items-start">
      {successMsg && (
        <div className="lg:col-span-5 rounded-xl bg-primary-soft border border-primary/20 text-primary px-4 py-3 text-center font-semibold">
          {successMsg}
        </div>
      )}

      <div className="lg:col-span-3 space-y-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">POS Kasir</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Scan atau pilih produk, lalu bayar</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <button
            onClick={() => setShowScanner((v) => !v)}
            className={`flex-1 py-3.5 rounded-xl font-semibold shadow-sm transition-colors ${
              showScanner
                ? "bg-danger text-white"
                : "btn-primary"
            }`}
          >
            {showScanner ? "Tutup Scanner" : "Scan QR / Barcode"}
          </button>

          <div className="relative flex-1">
            <button
              onClick={() => {
                setShowDropdown((v) => !v);
                setSearchQuery("");
              }}
              className="w-full py-3.5 rounded-xl font-semibold border border-border bg-surface text-foreground shadow-sm hover:bg-muted transition-colors"
            >
              + Pilih Produk
            </button>
            {showDropdown && (
              <div className="absolute z-20 mt-1.5 w-full card-surface overflow-hidden shadow-lg">
                <div className="p-2 border-b border-border">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Cari produk..."
                    autoFocus
                    className="input-field py-2.5 text-sm"
                  />
                </div>
                <div className="max-h-56 overflow-y-auto">
                  {filtered.length === 0 ? (
                    <p className="px-4 py-4 text-sm text-muted-foreground text-center">
                      Tidak ditemukan
                    </p>
                  ) : (
                    filtered.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => {
                          addToCart(p);
                          setShowDropdown(false);
                          setSearchQuery("");
                        }}
                        className="w-full text-left px-4 py-3.5 hover:bg-primary-soft/60 border-b border-border last:border-0 transition-colors active:bg-primary-soft"
                      >
                        <span className="font-medium block">{p.nama}</span>
                        <span className="text-muted-foreground text-sm font-mono">
                          {rupiah(p.hargaJual)}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {showScanner && (
          <div className="card-surface overflow-hidden p-2">
            <div id="reader" className="rounded-xl overflow-hidden" />
          </div>
        )}

        <div className="card-surface p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Keranjang</h2>
            <span className="text-xs text-muted-foreground">
              {cart.length === 0 ? "Kosong" : `${cart.length} item`}
            </span>
          </div>

          {cart.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border py-10 text-center">
              <p className="text-sm text-muted-foreground">Belum ada produk</p>
              <p className="text-xs text-muted-foreground mt-1">
                Scan barcode atau tekan + Pilih Produk
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {cart.map((item) => (
                <div
                  key={item.produkId}
                  className="flex items-center gap-2 sm:gap-3 rounded-xl border border-border p-3 bg-background/50"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{item.nama}</p>
                    <p className="text-sm text-muted-foreground font-mono">
                      {rupiah(item.hargaJual)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                    <button
                      onClick={() => changeQty(item.produkId, -1)}
                      className="w-10 h-10 rounded-full bg-muted font-bold text-lg flex items-center justify-center active:scale-95 transition-transform"
                      aria-label="Kurangi"
                    >
                      −
                    </button>
                    <span className="w-7 text-center font-bold tabular-nums">{item.qty}</span>
                    <button
                      onClick={() => changeQty(item.produkId, 1)}
                      className="w-10 h-10 rounded-full bg-primary text-white font-bold text-lg flex items-center justify-center active:scale-95 transition-transform"
                      aria-label="Tambah"
                    >
                      +
                    </button>
                  </div>
                  <div className="text-right min-w-[72px] sm:min-w-[88px] shrink-0">
                    <p className="font-semibold font-mono text-sm sm:text-base">
                      {rupiah(item.hargaJual * item.qty)}
                    </p>
                  </div>
                  <button
                    onClick={() => removeItem(item.produkId)}
                    className="w-9 h-9 rounded-full bg-danger-soft text-danger font-bold flex items-center justify-center shrink-0"
                    aria-label="Hapus"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="lg:col-span-2 lg:sticky lg:top-24 space-y-3">
        <div className="card-surface p-4 space-y-4">
          <div className="flex justify-between items-center pb-3 border-b border-border">
            <span className="text-muted-foreground font-medium">Total bayar</span>
            <span className="text-2xl font-bold font-mono text-primary">{rupiah(total)}</span>
          </div>

          <div>
            <p className="text-sm font-semibold mb-2">Metode bayar</p>
            <div className="grid grid-cols-3 gap-2">
              {(["CASH", "QRIS", "TRANSFER"] as const).map((m) => (
                <button
                  key={m}
                  disabled={cart.length === 0}
                  onClick={() => {
                    setMetodeBayar(m);
                    if (m !== "CASH") setUangDiterima("");
                  }}
                  className={`py-3 rounded-xl text-sm font-semibold transition-colors disabled:opacity-40 ${
                    metodeBayar === m
                      ? "bg-primary text-white shadow-sm"
                      : "bg-muted text-muted-foreground border border-border"
                  }`}
                >
                  {m === "CASH" ? "Tunai" : m}
                </button>
              ))}
            </div>
          </div>

          {metodeBayar === "CASH" && cart.length > 0 && (
            <div className="space-y-2">
              <label className="text-sm font-semibold">Uang diterima</label>
              <input
                type="number"
                value={uangDiterima}
                onChange={(e) => setUangDiterima(e.target.value)}
                className="input-field text-lg font-mono"
                placeholder="0"
                inputMode="numeric"
              />
              {uangDiterima && Number(uangDiterima) >= total && (
                <div className="rounded-xl bg-primary-soft border border-primary/15 p-4 text-center">
                  <p className="text-sm text-primary font-medium">Kembalian</p>
                  <p className="text-3xl font-bold text-primary font-mono mt-1">
                    {rupiah(kembalian)}
                  </p>
                </div>
              )}
              {uangDiterima && Number(uangDiterima) < total && (
                <p className="text-sm text-danger font-medium">Uang kurang dari total</p>
              )}
            </div>
          )}

          <button
            onClick={checkout}
            disabled={!canBayar}
            className="btn-primary w-full py-4 text-lg"
          >
            {paying ? "Memproses..." : "BAYAR"}
          </button>
        </div>
      </div>
    </div>
  );
}
