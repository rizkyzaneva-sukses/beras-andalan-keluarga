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
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    fetch("/api/produk").then((r) => r.json()).then(setProduk).catch(() => {});
  }, []);

  useEffect(() => {
    if (showScanner) {
      scannerRef.current = new Html5QrcodeScanner("reader", { fps: 10, qrbox: { width: 250, height: 150 }, supportedScanTypes: [] }, false);
      scannerRef.current.render(onScanSuccess, onScanError);
    }
    return () => { if (scannerRef.current) { scannerRef.current.clear().catch(() => {}); } };
  }, [showScanner]);

  const onScanSuccess = useCallback((decodedText: string) => {
    const product = produk.find((p) => p.id === decodedText);
    if (product) addToCart(product);
    if (scannerRef.current) scannerRef.current.clear().catch(() => {});
    setShowScanner(false);
  }, [produk]);

  const onScanError = useCallback(() => {}, []);

  const addToCart = (product: Produk) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.produkId === product.id);
      if (existing) return prev.map((item) => item.produkId === product.id ? { ...item, qty: item.qty + 1 } : item);
      return [...prev, { produkId: product.id, nama: product.nama, hargaJual: product.hargaJual, qty: 1 }];
    });
  };

  const changeQty = (produkId: string, delta: number) => {
    setCart((prev) => prev.map((item) => item.produkId === produkId ? { ...item, qty: item.qty + delta } : item).filter((item) => item.qty > 0));
  };

  const removeItem = (produkId: string) => setCart((prev) => prev.filter((item) => item.produkId !== produkId));

  const total = cart.reduce((sum, item) => sum + item.hargaJual * item.qty, 0);
  const kembalian = uangDiterima ? Number(uangDiterima) - total : 0;
  const canBayar = cart.length > 0 && metodeBayar !== null && (metodeBayar !== "CASH" || (uangDiterima && Number(uangDiterima) >= total));

  const checkout = async () => {
    const today = new Date().toISOString().slice(0, 10);
    for (const item of cart) {
      await fetch("/api/penjualan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tanggal: today, produkId: item.produkId, qty: item.qty, hargaJual: item.hargaJual, total: item.hargaJual * item.qty, metodeBayar, hargaDisesuaikan: false }) });
    }
    setCart([]); setMetodeBayar(null); setUangDiterima(""); setSuccessMsg("Pembayaran berhasil!");
    setTimeout(() => setSuccessMsg(""), 2000);
  };

  const filtered = searchQuery ? produk.filter((p) => p.nama.toLowerCase().includes(searchQuery.toLowerCase())) : produk;

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      {successMsg && <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-xl text-center font-semibold">{successMsg}</div>}

      <h1 className="text-2xl font-bold text-center text-gray-800">POS Kasir</h1>

      <div className="flex gap-2">
        <button onClick={() => setShowScanner((v) => !v)} className={`flex-1 py-3 rounded-xl font-semibold shadow-sm ${showScanner ? "bg-red-500 text-white" : "bg-green-600 text-white"}`}>{showScanner ? "Tutup Scanner" : "Scan Barcode"}</button>

        <div className="relative flex-1">
          <button onClick={() => { setShowDropdown((v) => !v); setSearchQuery(""); }} className="w-full py-3 bg-gray-100 rounded-xl font-semibold shadow-sm border border-gray-300">+ Produk</button>
          {showDropdown && (
            <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
              <div className="p-2 border-b border-gray-100">
                <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Cari produk..." autoFocus className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
              </div>
              <div className="max-h-56 overflow-y-auto">
                {filtered.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-muted-foreground text-center">Tidak ditemukan</p>
                ) : (
                  filtered.map((p) => (
                    <button key={p.id} onClick={() => { addToCart(p); setShowDropdown(false); setSearchQuery(""); }} className="w-full text-left px-4 py-3 hover:bg-green-50 border-b border-gray-100 last:border-0 transition-colors">
                      <span className="font-medium">{p.nama}</span>
                      <span className="text-gray-500 ml-2 text-sm">{rupiah(p.hargaJual)}</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {showScanner && <div id="reader" className="rounded-xl overflow-hidden" />}

      {cart.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border p-4 space-y-3">
          <h2 className="font-semibold text-gray-700">Keranjang</h2>
          {cart.map((item) => (
            <div key={item.produkId} className="flex items-center justify-between border rounded-xl p-3">
              <div className="flex-1 min-w-0"><p className="font-medium truncate">{item.nama}</p><p className="text-sm text-gray-500">{rupiah(item.hargaJual)}</p></div>
              <div className="flex items-center gap-2 mx-3">
                <button onClick={() => changeQty(item.produkId, -1)} className="w-9 h-9 rounded-full bg-gray-200 font-bold text-lg flex items-center justify-center">-</button>
                <span className="w-6 text-center font-semibold">{item.qty}</span>
                <button onClick={() => changeQty(item.produkId, 1)} className="w-9 h-9 rounded-full bg-green-600 text-white font-bold text-lg flex items-center justify-center">+</button>
              </div>
              <div className="text-right min-w-[80px]"><p className="font-semibold">{rupiah(item.hargaJual * item.qty)}</p></div>
              <button onClick={() => removeItem(item.produkId)} className="ml-2 w-8 h-8 rounded-full bg-red-100 text-red-600 font-bold flex items-center justify-center">X</button>
            </div>
          ))}
          <div className="flex justify-between items-center pt-2 border-t"><span className="font-bold text-lg">Total</span><span className="font-bold text-lg text-green-700">{rupiah(total)}</span></div>
        </div>
      )}

      {cart.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border p-4 space-y-3">
          <h2 className="font-semibold text-gray-700">Metode Pembayaran</h2>
          <div className="flex gap-2">
            {(["CASH", "QRIS", "TRANSFER"] as const).map((m) => (
              <button key={m} onClick={() => { setMetodeBayar(m); if (m !== "CASH") setUangDiterima(""); }} className={`flex-1 py-3 rounded-xl font-semibold shadow-sm ${metodeBayar === m ? "bg-green-600 text-white" : "bg-gray-100 text-gray-700 border border-gray-300"}`}>{m === "CASH" ? "Tunai" : m}</button>
            ))}
          </div>

          {metodeBayar === "CASH" && (
            <div className="space-y-2">
              <div><label className="text-sm text-gray-600 font-medium">Uang Diterima</label><input type="number" value={uangDiterima} onChange={(e) => setUangDiterima(e.target.value)} className="w-full border border-gray-300 rounded-xl px-4 py-3 mt-1 text-lg" placeholder="Jumlah uang diterima" /></div>
              {uangDiterima && Number(uangDiterima) >= total && (<div className="bg-green-50 rounded-xl p-4 text-center"><p className="text-sm text-green-700">Kembalian</p><p className="text-3xl font-bold text-green-700">{rupiah(kembalian)}</p></div>)}
            </div>
          )}

          <button onClick={checkout} disabled={!canBayar} className={`w-full py-4 rounded-xl font-bold text-xl shadow-sm ${canBayar ? "bg-green-600 text-white" : "bg-gray-300 text-gray-500 cursor-not-allowed"}`}>BAYAR</button>
        </div>
      )}
    </div>
  );
}
