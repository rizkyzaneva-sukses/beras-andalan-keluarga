"use client";

import { useEffect, useState } from "react";
import JsBarcode from "jsbarcode";
import QRCode from "qrcode";
import { Product } from "@/types";

export default function BarcodePage() {
  const [produk, setProduk] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [format, setFormat] = useState<"CODE128" | "QR">("QR");
  const [qrDataUrls, setQrDataUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch("/api/produk")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setProduk(data.filter((p: Product) => p.aktif));
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (produk.length > 0) {
      if (format === "CODE128") {
        setTimeout(() => {
          produk.forEach((p) => {
            JsBarcode(`#barcode-${p.id}`, p.id, { format: "CODE128", width: 1.5, height: 50, displayValue: false, margin: 0 });
          });
        }, 50);
      } else {
        const urls: Record<string, string> = {};
        Promise.all(
          produk.map(async (p) => {
            const url = await QRCode.toDataURL(p.id, { width: 200, margin: 0, color: { dark: "#000", light: "#fff" } });
            urls[p.id] = url;
          })
        ).then(() => setQrDataUrls(urls));
      }
    }
  }, [produk, format]);

  return (
    <>
      <style jsx global>{`
        @media print {
          @page { size: 210mm 330mm; margin: 2mm; }
          body { background: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
          .print-area { display: block !important; background: white !important; padding: 0 !important; }
        }
        .print-area { display: block; background: white; padding: 0; }
      `}</style>

      <div className="max-w-4xl mx-auto space-y-3">
        <div className="no-print flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-lg font-bold">Cetak Barcode</h2>
          <div className="flex gap-2">
            <div className="flex bg-muted rounded-lg p-0.5">
              <button onClick={() => setFormat("QR")} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${format === "QR" ? "bg-white text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>QR Code</button>
              <button onClick={() => setFormat("CODE128")} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${format === "CODE128" ? "bg-white text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>CODE128</button>
            </div>
            <button onClick={() => window.print()} className="bg-primary text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-primary-hover active:bg-primary-hover/80 transition-colors shadow-sm">Cetak</button>
          </div>
        </div>

        <p className="no-print text-sm text-muted-foreground">{produk.length} produk aktif · {format === "QR" ? "QR Code" : "CODE128"}</p>

        {loading ? (
          <div className="text-center py-10"><div className="inline-block w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /><p className="text-muted-foreground text-sm mt-2">Memuat...</p></div>
        ) : produk.length === 0 ? (
          <div className="text-center py-10 bg-white border border-dashed border-border rounded-xl"><p className="text-muted-foreground text-sm">Tidak ada produk aktif</p></div>
        ) : (
          <div className="print-area">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1mm" }}>
              {produk.map((p) => (
                <div key={p.id} style={{ border: "1px dashed #ccc", padding: "2mm 2mm", textAlign: "center", pageBreakInside: "avoid" }}>
                  <p style={{ fontSize: "9pt", fontWeight: 700, margin: "0 0 1.5mm 0", lineHeight: 1.2, wordBreak: "break-word" }}>{p.nama}</p>
                  <div style={{ display: "flex", justifyContent: "center" }}>
                  {format === "CODE128" ? (
                    <svg id={`barcode-${p.id}`}></svg>
                  ) : qrDataUrls[p.id] ? (
                    <img src={qrDataUrls[p.id]} alt={p.nama} style={{ width: "28mm", height: "28mm" }} />
                  ) : (
                    <div style={{ width: "28mm", height: "28mm", background: "#f3f4f6" }} />
                  )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
