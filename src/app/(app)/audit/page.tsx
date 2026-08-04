"use client";

import { useEffect, useState } from "react";

interface AuditEntry {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  oldData: Record<string, unknown> | null;
  newData: Record<string, unknown> | null;
  username: string;
  createdAt: string;
}

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/audit").then((r) => r.json()).then((d) => { if (d.data) setLogs(d.data); setLoading(false); });
  }, []);

  function formatRupiah(n: unknown): string {
    if (typeof n === "number") return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);
    return String(n ?? "-");
  }

  function entityLabel(type: string) {
    const m: Record<string, string> = { PENJUALAN: "Penjualan", PEMBELANJAAN: "Pembelanjaan", MODAL: "Modal", PRODUK: "Produk" };
    return m[type] || type;
  }

  function actionLabel(a: string) { return a === "UPDATE" ? "Diubah" : a === "DELETE" ? "Dihapus" : a; }

  function renderValue(key: string, val: unknown): string {
    if (typeof val === "number" && (key.includes("harga") || key.includes("total") || key.includes("jumlah"))) return formatRupiah(val);
    if (key === "metodeBayar") return val === "CASH" ? "Tunai" : val === "TRANSFER" ? "Transfer" : val === "QRIS" ? "QRIS" : String(val);
    if (key === "kategori") return val === "RESTOCK" ? "Restock" : val === "OPERASIONAL" ? "Operasional" : val === "LAINNYA" ? "Lainnya" : String(val);
    if (typeof val === "boolean") return val ? "Ya" : "Tidak";
    return String(val ?? "-");
  }

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <h2 className="text-lg font-bold">Audit Trail</h2>

      {loading ? (
        <div className="text-center py-10"><div className="inline-block w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /><p className="text-muted-foreground text-sm mt-2">Memuat...</p></div>
      ) : logs.length === 0 ? (
        <div className="text-center py-10 bg-white border border-dashed border-border rounded-xl"><p className="text-muted-foreground text-sm">Belum ada aktivitas tercatat</p></div>
      ) : (
        <div className="space-y-2">
          {logs.map((l) => (
            <div key={l.id} className="bg-white border border-border rounded-xl p-3 shadow-sm">
              <div className="flex justify-between items-start cursor-pointer" onClick={() => setExpandedId(expandedId === l.id ? null : l.id)}>
                <div className="flex-1 min-w-0 mr-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2 py-0.5 bg-muted rounded text-[11px] font-medium">{entityLabel(l.entityType)}</span>
                    <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${l.action === "DELETE" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>{actionLabel(l.action)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{l.username} · {formatDate(l.createdAt)}</p>
                </div>
                <span className="text-muted-foreground text-xs">{expandedId === l.id ? "▲" : "▼"}</span>
              </div>

              {expandedId === l.id && (
                <div className="mt-3 pt-3 border-t border-border space-y-2">
                  {l.oldData && l.newData ? (
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <p className="text-[11px] font-medium text-muted-foreground mb-1">Sebelum</p>
                        {Object.entries(l.oldData).map(([k, v]) => (
                          <div key={k} className="flex justify-between py-0.5"><span className="text-muted-foreground mr-2">{k}</span><span className="font-medium">{renderValue(k, v)}</span></div>
                        ))}
                      </div>
                      <div>
                        <p className="text-[11px] font-medium text-muted-foreground mb-1">Sesudah</p>
                        {Object.entries(l.newData).map(([k, v]) => (
                          <div key={k} className="flex justify-between py-0.5"><span className="text-muted-foreground mr-2">{k}</span><span className="font-medium text-primary">{renderValue(k, v)}</span></div>
                        ))}
                      </div>
                    </div>
                  ) : l.oldData && !l.newData ? (
                    <div className="text-xs">
                      <p className="text-[11px] font-medium text-muted-foreground mb-1">Data dihapus:</p>
                      {Object.entries(l.oldData).map(([k, v]) => (
                        <div key={k} className="flex justify-between py-0.5"><span className="text-muted-foreground mr-2">{k}</span><span className="font-medium text-red-600">{renderValue(k, v)}</span></div>
                      ))}
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
