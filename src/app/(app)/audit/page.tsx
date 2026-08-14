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

const PAGE_SIZE = 20;

const ENTITY_LABELS: Record<string, string> = {
  PENJUALAN: "Penjualan",
  PEMBELANJAAN: "Pengeluaran",
  MODAL: "Modal",
  PRODUK: "Produk",
  USER: "User",
  UTANG: "Utang",
  PIUTANG: "Hutang pelanggan",
  STOK: "Stok",
};

const ACTION_LABELS: Record<string, string> = {
  CREATE: "Dicatat",
  UPDATE: "Diubah",
  DELETE: "Dihapus",
};

const FIELD_LABELS: Record<string, string> = {
  produkNama: "Produk",
  namaBarang: "Barang",
  nama: "Nama",
  username: "Username",
  qty: "Qty",
  jumlah: "Jumlah",
  harga: "Harga",
  hargaJual: "Harga jual",
  hargaBeli: "Harga beli",
  total: "Total",
  metodeBayar: "Bayar",
  kategori: "Kategori",
  statusBayar: "Status",
  satuan: "Satuan",
  tanggal: "Tanggal",
  keterangan: "Keterangan",
  namaPelanggan: "Pelanggan",
  stok: "Stok",
  arah: "Arah",
  role: "Role",
  isActive: "Aktif",
  hargaDisesuaikan: "Harga khusus",
  produkId: "Produk",
};

function formatRupiah(n: unknown): string {
  if (typeof n === "number") {
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);
  }
  return String(n ?? "-");
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function renderValue(key: string, val: unknown, entityType?: string): string {
  const moneyKeys = key.toLowerCase().includes("harga") || key === "total" || (key === "jumlah" && entityType !== "PEMBELANJAAN");
  if (typeof val === "number" && moneyKeys) {
    return formatRupiah(val);
  }
  if (key === "metodeBayar") return val === "CASH" ? "Tunai" : val === "TRANSFER" ? "Transfer" : val === "QRIS" ? "QRIS" : val === "HUTANG" ? "Hutang" : String(val);
  if (key === "kategori") return val === "RESTOCK" ? "Restock" : val === "OPERASIONAL" ? "Operasional" : val === "LAINNYA" ? "Lainnya" : String(val);
  if (key === "statusBayar") return val === "KREDIT" ? "Kredit" : "Tunai";
  if (key === "role") return val === "OWNER" ? "Pemilik" : val === "KASIR" ? "Kasir" : String(val);
  if (typeof val === "boolean") return val ? "Ya" : "Tidak";
  if (key === "tanggal" && typeof val === "string") {
    const parsed = new Date(val);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
    }
  }
  return String(val ?? "-");
}

function activitySummary(log: AuditEntry): string {
  const data = (log.action === "DELETE" ? log.oldData : log.newData) || log.oldData || {};
  if (log.entityType === "PENJUALAN") {
    const nama = String(data.produkNama || "produk");
    const qty = data.qty != null ? ` × ${data.qty}` : "";
    const total = typeof data.total === "number" ? ` · ${formatRupiah(data.total)}` : "";
    if (log.action === "CREATE") return `Jual ${nama}${qty}${total}`;
    if (log.action === "DELETE") return `Hapus penjualan ${nama}${total}`;
    return `Ubah penjualan ${nama}`;
  }
  if (log.entityType === "PEMBELANJAAN") {
    const nama = String(data.namaBarang || "pengeluaran");
    const total = typeof data.total === "number" ? ` · ${formatRupiah(data.total)}` : "";
    if (log.action === "CREATE") return `Pengeluaran ${nama}${total}`;
    if (log.action === "DELETE") return `Hapus pengeluaran ${nama}${total}`;
    return `Ubah pengeluaran ${nama}`;
  }
  if (log.entityType === "MODAL") {
    const jumlah = typeof data.jumlah === "number" ? formatRupiah(data.jumlah) : "modal";
    if (log.action === "CREATE") return `Tambah modal ${jumlah}`;
    if (log.action === "DELETE") return `Hapus modal ${jumlah}`;
    return `Ubah modal ${jumlah}`;
  }
  if (log.entityType === "PRODUK") {
    const nama = String(data.nama || "produk");
    if (log.action === "CREATE") return `Tambah produk ${nama}`;
    if (log.action === "DELETE") return `Hapus produk ${nama}`;
    return `Ubah produk ${nama}`;
  }
  if (log.entityType === "USER") {
    const nama = String(data.username || "user");
    if (log.action === "CREATE") return `Tambah user ${nama}`;
    if (log.action === "DELETE") return `Hapus user ${nama}`;
    return data.isActive === false ? `Nonaktifkan ${nama}` : data.isActive === true ? `Aktifkan ${nama}` : `Ubah user ${nama}`;
  }
  if (log.entityType === "UTANG") {
    const nama = String(data.namaBarang || "utang");
    const jumlah = typeof data.jumlah === "number" ? ` · ${formatRupiah(data.jumlah)}` : "";
    return `Bayar utang ${nama}${jumlah}`;
  }
  return `${ACTION_LABELS[log.action] || log.action} ${ENTITY_LABELS[log.entityType] || log.entityType}`;
}

function actionClass(action: string) {
  if (action === "DELETE") return "bg-red-100 text-red-700";
  if (action === "CREATE") return "bg-green-100 text-green-800";
  return "bg-amber-100 text-amber-700";
}

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [entity, setEntity] = useState("");
  const [action, setAction] = useState("");

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
    if (entity) params.set("entity", entity);
    if (action) params.set("action", action);
    fetch(`/api/audit?${params}`)
      .then((r) => r.json())
      .then((d) => {
        setLogs(d.data || []);
        setTotal(d.total || 0);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [page, entity, action]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);

  function changeFilter(nextEntity: string, nextAction: string) {
    setEntity(nextEntity);
    setAction(nextAction);
    setPage(1);
    setExpandedId(null);
  }

  return (
    <div className="page-wrap space-y-4">
      <div>
        <h2 className="text-lg font-bold">Audit Trail</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Semua aktivitas toko, termasuk penjualan dan perubahan data</p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {[
          { label: "Semua", entity: "", action: "" },
          { label: "Penjualan", entity: "PENJUALAN", action: "" },
          { label: "Pengeluaran", entity: "PEMBELANJAAN", action: "" },
          { label: "Modal", entity: "MODAL", action: "" },
          { label: "Produk", entity: "PRODUK", action: "" },
          { label: "User", entity: "USER", action: "" },
          { label: "Utang", entity: "UTANG", action: "" },
        ].map((f) => {
          const active = entity === f.entity && action === f.action;
          return (
            <button
              key={f.label}
              type="button"
              onClick={() => changeFilter(f.entity, f.action)}
              className={`px-3 py-2 rounded-xl text-[12px] font-semibold min-h-[36px] ${
                active ? "bg-primary text-white" : "bg-surface border border-border text-muted-foreground hover:bg-muted"
              }`}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="text-center py-10">
          <div className="inline-block w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground text-sm mt-2">Memuat...</p>
        </div>
      ) : logs.length === 0 ? (
        <div className="text-center py-10 bg-white border border-dashed border-border rounded-xl">
          <p className="text-muted-foreground text-sm">Belum ada aktivitas tercatat</p>
        </div>
      ) : (
        <div className="space-y-2">
          {logs.map((l) => {
            const detail = l.oldData || l.newData;
            return (
              <div key={l.id} className="bg-white border border-border rounded-xl p-3 shadow-sm">
                <div
                  className="flex justify-between items-start cursor-pointer"
                  onClick={() => setExpandedId(expandedId === l.id ? null : l.id)}
                >
                  <div className="flex-1 min-w-0 mr-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2 py-0.5 bg-muted rounded text-[11px] font-medium">{ENTITY_LABELS[l.entityType] || l.entityType}</span>
                      <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${actionClass(l.action)}`}>{ACTION_LABELS[l.action] || l.action}</span>
                    </div>
                    <p className="text-[14px] font-medium mt-1.5 leading-snug">{activitySummary(l)}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {l.username} · {formatDate(l.createdAt)}
                    </p>
                  </div>
                  {detail && <span className="text-muted-foreground text-xs mt-1">{expandedId === l.id ? "▲" : "▼"}</span>}
                </div>

                {expandedId === l.id && (
                  <div className="mt-3 pt-3 border-t border-border space-y-2">
                    {l.oldData && l.newData ? (
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <p className="text-[11px] font-medium text-muted-foreground mb-1">Sebelum</p>
                          {Object.entries(l.oldData).map(([k, v]) => (
                            <div key={k} className="flex justify-between py-0.5 gap-2">
                              <span className="text-muted-foreground">{FIELD_LABELS[k] || k}</span>
                              <span className="font-medium text-right">{renderValue(k, v, l.entityType)}</span>
                            </div>
                          ))}
                        </div>
                        <div>
                          <p className="text-[11px] font-medium text-muted-foreground mb-1">Sesudah</p>
                          {Object.entries(l.newData).map(([k, v]) => (
                            <div key={k} className="flex justify-between py-0.5 gap-2">
                              <span className="text-muted-foreground">{FIELD_LABELS[k] || k}</span>
                              <span className="font-medium text-primary text-right">{renderValue(k, v, l.entityType)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs">
                        {Object.entries((l.newData || l.oldData || {}) as Record<string, unknown>).map(([k, v]) => (
                          <div key={k} className="flex justify-between py-0.5 gap-2">
                            <span className="text-muted-foreground">{FIELD_LABELS[k] || k}</span>
                            <span className={`font-medium text-right ${l.action === "DELETE" ? "text-red-600" : ""}`}>{renderValue(k, v, l.entityType)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          <div className="flex items-center justify-between gap-2 pt-1">
            <p className="text-[11px] text-muted-foreground">
              {from}–{to} dari {total}
            </p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="min-w-[36px] h-9 px-2 rounded-lg text-sm font-semibold border border-border bg-surface disabled:opacity-40 hover:bg-muted"
              >
                ‹
              </button>
              <span className="text-[12px] font-semibold px-2">
                {page}/{totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="min-w-[36px] h-9 px-2 rounded-lg text-sm font-semibold border border-border bg-surface disabled:opacity-40 hover:bg-muted"
              >
                ›
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
