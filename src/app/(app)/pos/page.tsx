"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { digitsOnly, formatRibuan, formatRupiah } from "@/lib/money";

interface Produk {
  id: string;
  nama: string;
  hargaJual: number;
  satuan: string;
  stok: number;
}

interface CartItem {
  lineId: string;
  produkId: string;
  nama: string;
  satuan: string;
  hargaJual: number;
  qty: number;
  hargaDisesuaikan: boolean;
}

function newLineId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

const METODE = [
  { id: "CASH" as const, label: "Tunai" },
  { id: "QRIS" as const, label: "QRIS" },
  { id: "TRANSFER" as const, label: "Transfer" },
  { id: "HUTANG" as const, label: "Hutang" },
];

export default function PosPage() {
  const [produk, setProduk] = useState<Produk[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showScanner, setShowScanner] = useState(false);
  const [scanError, setScanError] = useState("");
  const [scanHint, setScanHint] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [metodeBayar, setMetodeBayar] = useState<(typeof METODE)[number]["id"] | null>(null);
  const [uangDiterima, setUangDiterima] = useState("");
  const [namaPelanggan, setNamaPelanggan] = useState("");
  const [namaSuggest, setNamaSuggest] = useState<string[]>([]);
  const [successMsg, setSuccessMsg] = useState("");
  const [payError, setPayError] = useState("");
  const [paying, setPaying] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editQty, setEditQty] = useState("");
  const [editHarga, setEditHarga] = useState("");
  const [editTotal, setEditTotal] = useState("");
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const handlingScan = useRef(false);
  const produkRef = useRef(produk);
  produkRef.current = produk;

  useEffect(() => {
    fetch("/api/produk")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setProduk(data);
      })
      .catch(() => {});
    fetch("/api/piutang")
      .then((r) => r.json())
      .then((json) => {
        if (Array.isArray(json.names)) setNamaSuggest(json.names);
      })
      .catch(() => {});
  }, []);

  const addToCart = useCallback((product: Produk) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.produkId === product.id && !item.hargaDisesuaikan);
      if (existing)
        return prev.map((item) =>
          item.produkId === product.id && !item.hargaDisesuaikan ? { ...item, qty: item.qty + 1 } : item
        );
      return [
        ...prev,
        {
          lineId: newLineId(),
          produkId: product.id,
          nama: product.nama,
          satuan: product.satuan,
          hargaJual: product.hargaJual,
          qty: 1,
          hargaDisesuaikan: false,
        },
      ];
    });
  }, []);

  const stopScanner = useCallback(async () => {
    const scanner = scannerRef.current;
    scannerRef.current = null;
    if (!scanner) return;
    try {
      if (scanner.isScanning) await scanner.stop();
    } catch {
      /* already stopped */
    }
    try {
      scanner.clear();
    } catch {
      /* ignore */
    }
  }, []);

  const onScanDecoded = useCallback(
    async (decodedText: string) => {
      if (handlingScan.current) return;
      handlingScan.current = true;
      const product = produkRef.current.find((p) => p.id === decodedText);
      if (product) {
        addToCart(product);
        setScanHint("");
        await stopScanner();
        setShowScanner(false);
      } else {
        setScanHint("Barcode tidak dikenali. Coba lagi atau pilih produk manual.");
      }
      handlingScan.current = false;
    },
    [addToCart, stopScanner]
  );

  useEffect(() => {
    if (!showScanner) return;
    let cancelled = false;
    setScanError("");
    setScanHint("");
    handlingScan.current = false;

    const scanner = new Html5Qrcode("barcode-reader");
    scannerRef.current = scanner;

    (async () => {
      try {
        const cameras = await Html5Qrcode.getCameras();
        if (cancelled) return;
        if (!cameras.length) {
          setScanError("Kamera tidak ditemukan di perangkat ini.");
          return;
        }
        const back = cameras.find((c) => /back|rear|environment|belakang/i.test(c.label));
        await scanner.start(
          back?.id ?? { facingMode: "environment" },
          { fps: 12, qrbox: { width: 280, height: 160 } },
          (text) => {
            onScanDecoded(text);
          },
          () => {}
        );
      } catch {
        if (!cancelled) {
          setScanError("Izinkan akses kamera di browser, lalu tekan Scan Barcode lagi.");
        }
      }
    })();

    return () => {
      cancelled = true;
      stopScanner();
    };
  }, [onScanDecoded, showScanner, stopScanner]);

  const changeQty = (lineId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => (item.lineId === lineId ? { ...item, qty: item.qty + delta } : item))
        .filter((item) => item.qty > 0)
    );
  };

  const removeItem = (lineId: string) =>
    setCart((prev) => prev.filter((item) => item.lineId !== lineId));

  const openEdit = (item: CartItem) => {
    setEditId(item.lineId);
    setEditQty(String(item.qty));
    setEditHarga(String(item.hargaJual));
    setEditTotal(String(item.hargaJual * item.qty));
  };

  const applyEdit = () => {
    if (!editId) return;
    const qty = Number(digitsOnly(editQty)) || 0;
    const harga = Number(digitsOnly(editHarga)) || 0;
    if (qty <= 0 || harga <= 0) return;
    const line = cart.find((item) => item.lineId === editId);
    const original = line ? produk.find((p) => p.id === line.produkId) : undefined;
    setCart((prev) =>
      prev.map((item) =>
        item.lineId === editId
          ? { ...item, qty, hargaJual: harga, hargaDisesuaikan: !original || original.hargaJual !== harga }
          : item
      )
    );
    setEditId(null);
  };

  const total = cart.reduce((sum, item) => sum + item.hargaJual * item.qty, 0);
  const diterima = Number(uangDiterima) || 0;
  const kembalian = uangDiterima ? diterima - total : 0;
  const canBayar =
    cart.length > 0 &&
    metodeBayar !== null &&
    !paying &&
    (metodeBayar !== "CASH" || (uangDiterima && diterima >= total)) &&
    (metodeBayar !== "HUTANG" || namaPelanggan.trim().length > 0);

  const checkout = async () => {
    if (!canBayar || !metodeBayar) return;
    setPaying(true);
    setPayError("");
    try {
      const today = new Date().toISOString().slice(0, 10);
      const res = await fetch("/api/penjualan/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tanggal: today,
          metodeBayar,
          namaPelanggan: metodeBayar === "HUTANG" ? namaPelanggan.trim() : undefined,
          items: cart.map((item) => ({
            produkId: item.produkId,
            qty: item.qty,
            hargaJual: item.hargaJual,
            total: item.hargaJual * item.qty,
            hargaDisesuaikan: item.hargaDisesuaikan,
          })),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setPayError(json.error || "Gagal menyimpan transaksi");
        return;
      }
      setCart([]);
      setMetodeBayar(null);
      setUangDiterima("");
      setNamaPelanggan("");
      setSuccessMsg(
        metodeBayar === "HUTANG"
          ? `Hutang tercatat atas nama ${namaPelanggan.trim()}`
          : "Pembayaran berhasil!"
      );
      setTimeout(() => setSuccessMsg(""), 2800);
    } finally {
      setPaying(false);
    }
  };

  const filtered = searchQuery
    ? produk.filter((p) => p.nama.toLowerCase().includes(searchQuery.toLowerCase()))
    : produk;

  const filteredNames = namaPelanggan
    ? namaSuggest.filter((n) => n.toLowerCase().includes(namaPelanggan.toLowerCase()) && n.toLowerCase() !== namaPelanggan.toLowerCase())
    : namaSuggest;

  return (
    <div className="page-wrap space-y-4 lg:space-y-0 lg:grid lg:grid-cols-5 lg:gap-6 lg:items-start">
      {successMsg && (
        <div className="lg:col-span-5 rounded-xl bg-primary-soft border border-primary/20 text-primary px-4 py-3 text-center font-semibold">
          {successMsg}
        </div>
      )}
      {payError && (
        <div className="lg:col-span-5 rounded-xl bg-danger-soft border border-danger/20 text-danger px-4 py-3 text-center font-semibold">
          {payError}
        </div>
      )}

      <div className="lg:col-span-3 space-y-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">POS Kasir</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Scan barcode atau pilih produk, lalu bayar</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <button
            onClick={() => {
              if (showScanner) {
                stopScanner();
                setShowScanner(false);
              } else {
                setShowDropdown(false);
                setShowScanner(true);
              }
            }}
            className={`flex-1 py-3.5 rounded-xl font-semibold shadow-sm transition-colors ${
              showScanner ? "bg-danger text-white" : "btn-primary"
            }`}
          >
            {showScanner ? "Tutup Scanner" : "Scan Barcode"}
          </button>

          <div className="relative flex-1">
            <button
              onClick={() => {
                setShowDropdown((v) => !v);
                setSearchQuery("");
                if (showScanner) {
                  stopScanner();
                  setShowScanner(false);
                }
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
                    <p className="px-4 py-4 text-sm text-muted-foreground text-center">Tidak ditemukan</p>
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
                          {formatRupiah(p.hargaJual)} · stok {p.stok} {p.satuan}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className={showScanner ? "card-surface overflow-hidden p-3 space-y-2" : "hidden"}>
          <p className="text-sm font-semibold text-center">Arahkan kamera ke barcode</p>
          <p className="text-xs text-muted-foreground text-center">Kamera terbuka otomatis. Tidak perlu pilih gambar.</p>
          <div id="barcode-reader" className="rounded-xl overflow-hidden bg-black/80 min-h-[220px]" />
          {scanError && <p className="text-sm text-danger font-medium text-center">{scanError}</p>}
          {scanHint && !scanError && <p className="text-sm text-warning font-medium text-center">{scanHint}</p>}
        </div>

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
              <p className="text-xs text-muted-foreground mt-1">Scan barcode atau tekan + Pilih Produk</p>
            </div>
          ) : (
            <div className="space-y-2">
              {cart.map((item) => (
                <div key={item.lineId} className="rounded-xl border border-border p-3 bg-background/50 space-y-2">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{item.nama}</p>
                      <p className="text-sm text-muted-foreground font-mono">
                        {formatRupiah(item.hargaJual)}
                        {item.satuan ? ` / ${item.satuan}` : ""}
                        {item.hargaDisesuaikan && (
                          <span className="ml-1.5 text-[11px] text-amber-700 font-semibold not-italic">harga khusus</span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                      <button
                        onClick={() => changeQty(item.lineId, -1)}
                        className="w-10 h-10 rounded-full bg-muted font-bold text-lg flex items-center justify-center active:scale-95 transition-transform"
                        aria-label="Kurangi"
                      >
                        −
                      </button>
                      <span className="w-7 text-center font-bold tabular-nums">{item.qty}</span>
                      <button
                        onClick={() => changeQty(item.lineId, 1)}
                        className="w-10 h-10 rounded-full bg-primary text-white font-bold text-lg flex items-center justify-center active:scale-95 transition-transform"
                        aria-label="Tambah"
                      >
                        +
                      </button>
                    </div>
                    <div className="text-right min-w-[72px] sm:min-w-[88px] shrink-0">
                      <p className="font-semibold font-mono text-sm sm:text-base">
                        {formatRupiah(item.hargaJual * item.qty)}
                      </p>
                    </div>
                    <button
                      onClick={() => removeItem(item.lineId)}
                      className="w-9 h-9 rounded-full bg-danger-soft text-danger font-bold flex items-center justify-center shrink-0"
                      aria-label="Hapus"
                    >
                      ×
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => (editId === item.lineId ? setEditId(null) : openEdit(item))}
                    className="text-xs font-semibold text-primary hover:underline"
                  >
                    {editId === item.lineId ? "Tutup ubah harga" : "Ubah jumlah / harga (telur timbangan)"}
                  </button>
                  {editId === item.lineId && (
                    <div className="rounded-xl bg-muted/70 p-3 space-y-2">
                      <p className="text-[11px] text-muted-foreground">
                        Untuk telur ditimbang: isi jumlah 1, lalu ketik total harga hasil timbang.
                      </p>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="text-[11px] font-medium">Jumlah{item.satuan ? ` (${item.satuan})` : ""}</label>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={editQty}
                            onChange={(e) => {
                              const q = digitsOnly(e.target.value);
                              setEditQty(q);
                              const h = Number(digitsOnly(editHarga)) || 0;
                              setEditTotal(q && h ? String(Number(q) * h) : "");
                            }}
                            className="input-field py-2 text-sm font-mono"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-medium">Harga satuan</label>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={formatRibuan(editHarga)}
                            onChange={(e) => {
                              const h = digitsOnly(e.target.value);
                              setEditHarga(h);
                              const q = Number(digitsOnly(editQty)) || 0;
                              setEditTotal(q && h ? String(q * Number(h)) : "");
                            }}
                            className="input-field py-2 text-sm font-mono"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-medium">Total</label>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={formatRibuan(editTotal)}
                            onChange={(e) => {
                              const t = digitsOnly(e.target.value);
                              setEditTotal(t);
                              const q = Number(digitsOnly(editQty)) || 1;
                              setEditQty(String(q));
                              setEditHarga(t ? String(Math.round(Number(t) / q)) : "");
                            }}
                            className="input-field py-2 text-sm font-mono"
                          />
                        </div>
                      </div>
                      <button type="button" onClick={applyEdit} className="btn-primary w-full py-2.5 text-sm">
                        Simpan harga
                      </button>
                    </div>
                  )}
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
            <span className="text-2xl font-bold font-mono text-primary">{formatRupiah(total)}</span>
          </div>

          <div>
            <p className="text-sm font-semibold mb-2">Metode bayar</p>
            <div className="grid grid-cols-2 gap-2">
              {METODE.map((m) => (
                <button
                  key={m.id}
                  disabled={cart.length === 0}
                  onClick={() => {
                    setMetodeBayar(m.id);
                    if (m.id !== "CASH") setUangDiterima("");
                    if (m.id !== "HUTANG") setNamaPelanggan("");
                  }}
                  className={`py-3 rounded-xl text-sm font-semibold transition-colors disabled:opacity-40 ${
                    metodeBayar === m.id
                      ? m.id === "HUTANG"
                        ? "bg-amber-600 text-white shadow-sm"
                        : "bg-primary text-white shadow-sm"
                      : "bg-muted text-muted-foreground border border-border"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {metodeBayar === "CASH" && cart.length > 0 && (
            <div className="space-y-2">
              <label className="text-sm font-semibold">Uang diterima</label>
              <input
                type="text"
                inputMode="numeric"
                value={formatRibuan(uangDiterima)}
                onChange={(e) => setUangDiterima(digitsOnly(e.target.value))}
                className="input-field text-lg font-mono"
                placeholder="Contoh: 150.000"
              />
              {uangDiterima && diterima >= total && (
                <div className="rounded-xl bg-primary-soft border border-primary/15 p-4 text-center">
                  <p className="text-sm text-primary font-medium">Kembalian</p>
                  <p className="text-3xl font-bold text-primary font-mono mt-1">{formatRupiah(kembalian)}</p>
                </div>
              )}
              {uangDiterima && diterima < total && (
                <p className="text-sm text-danger font-medium">Uang kurang dari total</p>
              )}
            </div>
          )}

          {metodeBayar === "HUTANG" && cart.length > 0 && (
            <div className="space-y-2">
              <label className="text-sm font-semibold">Nama pelanggan</label>
              <input
                type="text"
                value={namaPelanggan}
                onChange={(e) => setNamaPelanggan(e.target.value)}
                className="input-field"
                placeholder="Contoh: Bu Siti"
                autoComplete="off"
              />
              {filteredNames.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {filteredNames.slice(0, 6).map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setNamaPelanggan(n)}
                      className="px-2.5 py-1 rounded-lg text-xs font-medium bg-muted border border-border"
                    >
                      {n}
                    </button>
                  ))}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Belanja dicatat sebagai hutang. Pembayaran belakangan di menu Utang → Hutang Pelanggan.
              </p>
            </div>
          )}

          <button onClick={checkout} disabled={!canBayar} className="btn-primary w-full py-4 text-lg">
            {paying ? "Memproses..." : metodeBayar === "HUTANG" ? "CATAT HUTANG" : "BAYAR"}
          </button>
        </div>
      </div>
    </div>
  );
}
