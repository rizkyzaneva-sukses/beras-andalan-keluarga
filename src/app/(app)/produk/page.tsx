"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Product, StokAdjustmentEntry, TipeProduk } from "@/types";
import { digitsOnly, formatRibuan, formatRupiah } from "@/lib/money";
import {
  formatKarungQty,
  hitungHppGabungan,
  isKelipatanSetengahKarung,
  langkahKarung,
} from "@/lib/gabungan";
import { allowsFractionQty, formatQty, hasEnoughStock, parseQtyInput, sanitizeQtyInput, toQty } from "@/lib/qty";
import { CONTOH_CSV, parseTabelProduk, validateBarisImport, validateBarisSo } from "@/lib/import-tabel";
import { SearchSelect } from "@/components/SearchSelect";

type StockMode = "isi" | "kurang" | "pindah" | "adjust" | null;

const SATUAN = [
  { value: "kg", label: "Kg" },
  { value: "karung", label: "Karung" },
  { value: "liter", label: "Liter" },
  { value: "pcs", label: "Pcs" },
  { value: "butir", label: "Butir" },
];

const ALASAN_SO = ["SO mingguan", "Rusak / pecah", "Hilang", "Salah catat", "Sample / bonus", "Lainnya"];

export default function ProdukPage() {
  const [produk, setProduk] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ nama: "", satuan: "kg", hargaBeli: "", hargaJual: "" });
  const [error, setError] = useState("");
  const [stockMode, setStockMode] = useState<StockMode>(null);
  const [stockId, setStockId] = useState<string | null>(null);
  const [stockJumlah, setStockJumlah] = useState("");
  const [stockHarga, setStockHarga] = useState("");
  const [stockCatatan, setStockCatatan] = useState("");
  const [pindahKe, setPindahKe] = useState("");
  const [pindahJumlahKe, setPindahJumlahKe] = useState("");
  const [showPindahScanner, setShowPindahScanner] = useState(false);
  const [pindahScanError, setPindahScanError] = useState("");
  const [pindahScanHint, setPindahScanHint] = useState("");
  const pindahScannerRef = useRef<Html5Qrcode | null>(null);
  const pindahHandlingScan = useRef(false);
  const tujuanListRef = useRef<Product[]>([]);
  const [stockError, setStockError] = useState("");
  const [stockSaving, setStockSaving] = useState(false);
  const [adjustments, setAdjustments] = useState<StokAdjustmentEntry[]>([]);
  const [historySearch, setHistorySearch] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState("");
  const [importSaving, setImportSaving] = useState(false);
  const [importMsg, setImportMsg] = useState("");
  const [soMode, setSoMode] = useState(false);
  const [soFisik, setSoFisik] = useState<Record<string, string>>({});
  const [soAlasan, setSoAlasan] = useState("SO mingguan");
  const [soPaste, setSoPaste] = useState("");
  const [soSaving, setSoSaving] = useState(false);
  const [soError, setSoError] = useState("");
  const [soMsg, setSoMsg] = useState("");
  // New: tipe & komposisi
  const [formTipe, setFormTipe] = useState<TipeProduk>("KARUNG");
  const [formIsiPerKarung, setFormIsiPerKarung] = useState("25");
  const [formSumberId, setFormSumberId] = useState("");
  const [formKomposisi, setFormKomposisi] = useState<{ sumberId: string; qtyPerBatch: string }[]>([]);
  const [bukaKarungId, setBukaKarungId] = useState<string | null>(null);
  const [bukaKarungEceranId, setBukaKarungEceranId] = useState("");
  const [bukaKarungBatch, setBukaKarungBatch] = useState("1");
  const [bukaKarungMsg, setBukaKarungMsg] = useState("");
  const [bukaKarungErr, setBukaKarungErr] = useState("");
  const [bukaKarungSaving, setBukaKarungSaving] = useState(false);

  async function fetchProduk() {
    const res = await fetch("/api/produk");
    const data = await res.json();
    if (Array.isArray(data)) setProduk(data);
    setLoading(false);
  }

  async function fetchAdjustments() {
    const res = await fetch("/api/produk/adjust?limit=40");
    const json = await res.json();
    if (Array.isArray(json.data)) setAdjustments(json.data);
  }

  useEffect(() => {
    fetchProduk();
    fetchAdjustments();
  }, []);

  function openAdd() {
    setEditId(null);
    setForm({ nama: "", satuan: "kg", hargaBeli: "", hargaJual: "" });
    setFormTipe("KARUNG");
    setFormIsiPerKarung("25");
    setFormSumberId("");
    setFormKomposisi([]);
    setShowForm(true);
    setShowImport(false);
    setSoMode(false);
    setError("");
    setBukaKarungId(null);
    closeStock();
  }
  function openEdit(p: Product) {
    setEditId(p.id);
    setForm({ nama: p.nama, satuan: p.satuan, hargaBeli: String(p.hargaBeli), hargaJual: String(p.hargaJual) });
    setFormTipe(p.tipe || "KARUNG");
    setFormIsiPerKarung(p.isiPerKarung ? String(p.isiPerKarung) : "25");
    setFormSumberId(p.sumberProdukId || "");
    setFormKomposisi(
      (p.komposisi || []).map((k) => ({ sumberId: k.sumberId, qtyPerBatch: String(k.qtyPerBatch) }))
    );
    setShowForm(true);
    setError("");
    setBukaKarungId(null);
    closeStock();
  }

  function openStock(mode: StockMode, p: Product) {
    setShowForm(false);
    setBukaKarungId(null);
    setStockMode(mode);
    setStockId(p.id);
    setStockJumlah("");
    setStockHarga("");
    setStockCatatan("");
    setPindahKe("");
    setPindahJumlahKe("");
    setShowPindahScanner(false);
    setPindahScanError("");
    setPindahScanHint("");
    setStockError("");
  }

  const stopPindahScanner = useCallback(async () => {
    const scanner = pindahScannerRef.current;
    pindahScannerRef.current = null;
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

  function closeStock() {
    stopPindahScanner();
    setShowPindahScanner(false);
    setStockMode(null);
    setStockId(null);
    setStockError("");
  }

  function selectPindahTujuan(p: Product) {
    setPindahKe(p.id);
    setPindahScanHint("");
    setStockError("");
  }

  const hppGabunganPreview = useMemo(() => {
    if (formTipe !== "GABUNGAN") return { totalBiaya: 0, totalKg: 0, hppPerKg: 0 };
    const items = formKomposisi.flatMap((k) => {
      if (!k.sumberId) return [];
      const sumber = produk.find((p) => p.id === k.sumberId);
      if (!sumber) return [];
      const qty = parseQtyInput(k.qtyPerBatch);
      if (!Number.isFinite(qty) || qty <= 0) return [];
      return [
        {
          qtyPerBatch: qty,
          hargaBeli: sumber.hargaBeli,
          hppRataRata: sumber.hppRataRata,
          isiPerKarung: sumber.isiPerKarung,
        },
      ];
    });
    return hitungHppGabungan(items);
  }, [formTipe, formKomposisi, produk]);
  const hargaBeliGabunganPreview = hppGabunganPreview.hppPerKg;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (formTipe === "GABUNGAN") {
      const resep = formKomposisi
        .map((k) => ({ sumberId: k.sumberId, qty: parseQtyInput(k.qtyPerBatch) }))
        .filter((k) => k.sumberId && Number.isFinite(k.qty) && k.qty > 0);
      if (resep.length === 0) {
        setError("Produk gabungan harus punya minimal 1 komposisi");
        return;
      }
      if (resep.some((k) => !isKelipatanSetengahKarung(k.qty))) {
        setError("Jumlah campuran harus kelipatan ½ karung atau 1 karung");
        return;
      }
      if (!hargaBeliGabunganPreview || hargaBeliGabunganPreview <= 0 || hppGabunganPreview.totalKg <= 0) {
        setError("HPP dari resep belum valid — cek komponen dan isi per karung");
        return;
      }
    }
    const body = {
      ...form,
      satuan: formTipe === "GABUNGAN" ? "kg" : form.satuan,
      hargaBeli: formTipe === "GABUNGAN" ? hargaBeliGabunganPreview : Number(digitsOnly(form.hargaBeli)),
      hargaJual: Number(digitsOnly(form.hargaJual)),
      tipe: formTipe,
      isiPerKarung: formTipe === "KARUNG" ? Number(formIsiPerKarung) : undefined,
      sumberProdukId: formTipe === "ECERAN" ? formSumberId : undefined,
      komposisi:
        formTipe === "GABUNGAN"
          ? formKomposisi
              .filter((k) => k.sumberId)
              .map((k) => ({ sumberId: k.sumberId, qtyPerBatch: parseQtyInput(k.qtyPerBatch) }))
          : undefined,
    };
    const url = editId ? `/api/produk/${editId}` : "/api/produk";
    const method = editId ? "PUT" : "POST";
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (res.ok) {
      setShowForm(false);
      fetchProduk();
    } else {
      const data = await res.json();
      setError(data.error || "Gagal menyimpan");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Hapus produk ini?")) return;
    await fetch(`/api/produk/${id}`, { method: "DELETE" });
    fetchProduk();
  }

  async function handleBukaKarung(productId: string) {
    setBukaKarungErr("");
    setBukaKarungMsg("");
    setBukaKarungSaving(true);
    const target = produk.find((p) => p.id === productId);
    try {
      const body =
        target?.tipe === "GABUNGAN"
          ? { gabunganId: productId, jumlahBatch: Math.max(1, Math.floor(Number(bukaKarungBatch) || 1)) }
          : { karungId: productId, eceranId: bukaKarungEceranId || undefined };
      const res = await fetch("/api/produk/buka-karung", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        setBukaKarungErr(json.error || "Gagal buka karung");
        return;
      }
      setBukaKarungMsg(json.message);
      fetchProduk();
    } finally {
      setBukaKarungSaving(false);
    }
  }

  const active = produk.filter((p) => p.aktif !== false);
  const selected = active.find((p) => p.id === stockId) || null;
  const tujuanList = useMemo(
    () => produk.filter((p) => p.aktif !== false && p.id !== stockId),
    [produk, stockId]
  );
  const pindahTujuanSelected = tujuanList.find((p) => p.id === pindahKe) || null;
  const karungList = active.filter((p) => p.tipe === "KARUNG");

  useEffect(() => {
    tujuanListRef.current = tujuanList;
  }, [tujuanList]);

  const onPindahScanDecoded = useCallback(
    async (decodedText: string) => {
      if (pindahHandlingScan.current) return;
      pindahHandlingScan.current = true;
      const code = decodedText.trim();
      const product = tujuanListRef.current.find((p) => p.id === code);
      if (product) {
        selectPindahTujuan(product);
        setPindahScanHint("");
        await stopPindahScanner();
        setShowPindahScanner(false);
      } else {
        setPindahScanHint("Barcode tidak dikenali atau produk sama dengan sumber. Coba lagi.");
      }
      pindahHandlingScan.current = false;
    },
    [stopPindahScanner]
  );

  useEffect(() => {
    if (!showPindahScanner) return;
    let cancelled = false;
    setPindahScanError("");
    setPindahScanHint("");
    pindahHandlingScan.current = false;

    const scanner = new Html5Qrcode("pindah-barcode-reader");
    pindahScannerRef.current = scanner;

    (async () => {
      try {
        const cameras = await Html5Qrcode.getCameras();
        if (cancelled) return;
        if (!cameras.length) {
          setPindahScanError("Kamera tidak ditemukan di perangkat ini.");
          return;
        }
        const back = cameras.find((c) => /back|rear|environment|belakang/i.test(c.label));
        await scanner.start(
          back?.id ?? { facingMode: "environment" },
          { fps: 12, qrbox: { width: 280, height: 160 } },
          (text) => {
            onPindahScanDecoded(text);
          },
          () => {}
        );
      } catch {
        if (!cancelled) {
          setPindahScanError("Izinkan akses kamera di browser, lalu tekan Scan lagi.");
        }
      }
    })();

    return () => {
      cancelled = true;
      stopPindahScanner();
    };
  }, [onPindahScanDecoded, showPindahScanner, stopPindahScanner]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q ? active.filter((p) => p.nama.toLowerCase().includes(q)) : active;
    return [...list].sort((a, b) => a.nama.localeCompare(b.nama, "id"));
  }, [active, search]);

  const filteredHistory = useMemo(() => {
    const q = historySearch.trim().toLowerCase();
    if (!q) return adjustments;
    return adjustments.filter(
      (row) =>
        row.produkNama.toLowerCase().includes(q) ||
        row.alasan.toLowerCase().includes(q) ||
        row.createdByUsername.toLowerCase().includes(q)
    );
  }, [adjustments, historySearch]);

  const adjustFisik = selected && stockMode === "adjust" ? parseQtyInput(stockJumlah) : NaN;
  const adjustSelisih = selected && Number.isFinite(adjustFisik) ? toQty(adjustFisik - toQty(selected.stok)) : NaN;

  async function handleStock() {
    if (!stockId || !stockMode) return;
    setStockError("");
    const fraction = selected && allowsFractionQty(selected);

    if (stockMode === "adjust") {
      const fisik = parseQtyInput(stockJumlah);
      if (!Number.isFinite(fisik) || fisik < 0) {
        setStockError(fraction ? "Isi stok fisik, boleh pecahan (0,7 / 1/4)" : "Isi stok fisik hasil hitung");
        return;
      }
      if (!fraction && !Number.isInteger(fisik)) {
        setStockError("Stok fisik harus bilangan bulat");
        return;
      }
      const alasan = stockCatatan.trim();
      if (alasan.length < 3) {
        setStockError("Alasan penyesuaian wajib diisi");
        return;
      }
      setStockSaving(true);
      try {
        const res = await fetch(`/api/produk/${stockId}/adjust`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stokFisik: fisik, alasan }),
        });
        const json = await res.json();
        if (!res.ok) {
          setStockError(json.error || "Gagal menyesuaikan stok");
          return;
        }
        closeStock();
        fetchProduk();
        fetchAdjustments();
      } finally {
        setStockSaving(false);
      }
      return;
    }

    const jumlah = fraction ? parseQtyInput(stockJumlah) : Number(digitsOnly(stockJumlah));
    if (!jumlah || jumlah <= 0) {
      setStockError(fraction ? "Isi jumlah, boleh pecahan (0,7 / 1/4 / 1/2)" : "Isi jumlah");
      return;
    }
    setStockSaving(true);
    try {
      if (stockMode === "pindah") {
        const tujuan = tujuanList.find((p) => p.id === pindahKe);
        const toQtyVal = tujuan && allowsFractionQty(tujuan) ? parseQtyInput(pindahJumlahKe) : Number(digitsOnly(pindahJumlahKe));
        if (!pindahKe) {
          setStockError("Pilih produk tujuan");
          setStockSaving(false);
          return;
        }
        if (!toQtyVal || toQtyVal <= 0) {
          setStockError("Isi jumlah yang ditambahkan ke produk eceran");
          setStockSaving(false);
          return;
        }
        const res = await fetch("/api/produk/konversi", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fromId: stockId, fromQty: jumlah, toId: pindahKe, toQty: toQtyVal }),
        });
        const json = await res.json();
        if (!res.ok) {
          setStockError(json.error || "Gagal memindah stok");
          return;
        }
      } else {
        const harga = stockMode === "isi" ? Number(digitsOnly(stockHarga)) : undefined;
        const res = await fetch(`/api/produk/${stockId}/stok`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            arah: stockMode === "isi" ? "tambah" : "kurang",
            jumlah,
            harga: harga && harga > 0 ? harga : undefined,
            catatan: stockCatatan || undefined,
          }),
        });
        const json = await res.json();
        if (!res.ok) {
          setStockError(json.error || "Gagal mengubah stok");
          return;
        }
      }
      closeStock();
      fetchProduk();
    } finally {
      setStockSaving(false);
    }
  }

  const importPreview = useMemo(() => parseTabelProduk(importText).map(validateBarisImport), [importText]);
  const importOk = importPreview.filter((r) => !r.error);
  const importBad = importPreview.filter((r) => r.error);

  async function handleImport() {
    setImportMsg("");
    if (importOk.length === 0) {
      setImportMsg("Tidak ada baris valid untuk diimpor");
      return;
    }
    setImportSaving(true);
    try {
      const res = await fetch("/api/produk/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: importOk }),
      });
      const json = await res.json();
      if (!res.ok) {
        setImportMsg(json.error || "Gagal mengimpor");
        return;
      }
      const skip = Array.isArray(json.skipped) && json.skipped.length ? ` · dilewati ${json.skipped.length}` : "";
      setImportMsg(`Berhasil menambah ${json.created} produk${skip}`);
      setImportText("");
      fetchProduk();
    } finally {
      setImportSaving(false);
    }
  }

  function applySoPaste() {
    const rows = parseTabelProduk(soPaste).map(validateBarisSo);
    const next = { ...soFisik };
    let matched = 0;
    for (const row of rows) {
      if (row.error || !row.nama) continue;
      const hit = active.find((p) => p.nama.trim().toLowerCase() === row.nama.toLowerCase());
      if (!hit) continue;
      next[hit.id] = formatQty(row.jumlah);
      matched += 1;
    }
    setSoFisik(next);
    setSoError(matched === 0 ? "Tidak ada nama produk yang cocok" : "");
    setSoMsg(matched > 0 ? `${matched} baris terisi dari tabel` : "");
  }

  const soChanges = useMemo(() => {
    return active
      .map((p) => {
        const raw = soFisik[p.id];
        if (raw == null || raw.trim() === "") return null;
        const fisik = parseQtyInput(raw);
        if (!Number.isFinite(fisik)) return null;
        const sistem = toQty(p.stok);
        const selisih = toQty(fisik - sistem);
        if (selisih === 0) return null;
        return { id: p.id, nama: p.nama, satuan: p.satuan, sistem, fisik, selisih };
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row));
  }, [active, soFisik]);

  async function handleSoMassal() {
    setSoError("");
    setSoMsg("");
    if (soAlasan.trim().length < 3) {
      setSoError("Alasan SO wajib diisi");
      return;
    }
    if (soChanges.length === 0) {
      setSoError("Isi stok fisik yang berbeda dari stok sistem. Angka itu mengganti stok, bukan ditambah.");
      return;
    }
    setSoSaving(true);
    try {
      const res = await fetch("/api/produk/so", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          alasan: soAlasan.trim(),
          items: soChanges.map((row) => ({ produkId: row.id, stokFisik: row.fisik })),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setSoError(json.error || "Gagal menyimpan SO");
        return;
      }
      setSoMsg(`SO selesai. ${json.updated} produk diganti ke stok fisik.`);
      setSoFisik({});
      setSoPaste("");
      fetchProduk();
      fetchAdjustments();
    } finally {
      setSoSaving(false);
    }
  }

  function downloadContoh() {
    const blob = new Blob([CONTOH_CSV], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "contoh-upload-produk.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function onPickFile(file: File | undefined) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImportText(String(reader.result || ""));
    reader.readAsText(file);
  }

  function stockValue(p: Product) {
    return p.tipe === "GABUNGAN" && p.stokGabungan != null ? toQty(p.stokGabungan) : toQty(p.stok);
  }

  function gabunganStokHint(p: Product, stok: number) {
    const max = p.maxBatchProduksi ?? 0;
    if (stok <= 0 && max > 0) return `isi dari karung · ${max} batch`;
    if (stok <= 0) return "isi dari karung";
    if (max > 0) return `bisa ${max} batch lagi`;
    return "";
  }

  function ProductActions({ p }: { p: Product }) {
    return (
      <div className="flex flex-wrap gap-1.5">
        {p.tipe === "KARUNG" && (
          <button
            type="button"
            onClick={() => {
              setShowForm(false);
              closeStock();
              setBukaKarungId(p.id);
              setBukaKarungEceranId(p.eceranDariProduk?.[0]?.id || "");
              setBukaKarungBatch("1");
              setBukaKarungErr("");
              setBukaKarungMsg("");
            }}
            className="chip-action bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"
          >
            Buka 1
          </button>
        )}
        {p.tipe === "GABUNGAN" && (
          <button
            type="button"
            onClick={() => {
              setShowForm(false);
              closeStock();
              setBukaKarungId(p.id);
              setBukaKarungEceranId("");
              setBukaKarungBatch("1");
              setBukaKarungErr("");
              setBukaKarungMsg("");
            }}
            className="chip-action bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300"
          >
            Isi Stok
          </button>
        )}
        {p.tipe === "GABUNGAN" ? (
          <>
            <button type="button" onClick={() => openStock("adjust", p)} className="chip-action bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
              SO
            </button>
            <button type="button" onClick={() => openStock("kurang", p)} className="chip-action bg-muted text-muted-foreground">
              Kurangi
            </button>
          </>
        ) : (
          <>
            <button type="button" onClick={() => openStock("adjust", p)} className="chip-action bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
              SO
            </button>
            <button type="button" onClick={() => openStock("isi", p)} className="chip-action bg-primary-soft text-primary">
              Isi
            </button>
            <button type="button" onClick={() => openStock("kurang", p)} className="chip-action bg-muted text-muted-foreground">
              Kurangi
            </button>
            <button type="button" onClick={() => openStock("pindah", p)} className="chip-action bg-muted text-muted-foreground">
              Pindah
            </button>
          </>
        )}
        <button type="button" onClick={() => openEdit(p)} className="chip-action text-primary bg-primary-soft/50">
          Edit
        </button>
        <button type="button" onClick={() => handleDelete(p.id)} className="chip-action text-danger bg-danger-soft">
          Hapus
        </button>
      </div>
    );
  }

  function renderBukaKarungPanel() {
    if (!bukaKarungId) return null;
    const target = active.find((p) => p.id === bukaKarungId);
    if (!target) return null;

    if (target.tipe === "GABUNGAN") {
      const batch = Math.max(1, Math.floor(Number(bukaKarungBatch) || 1));
      const resep = target.komposisi || [];
      const rows = resep.map((k) => {
        const sumber = active.find((p) => p.id === k.sumberId);
        const need = toQty(toQty(k.qtyPerBatch) * batch);
        const stok = sumber ? toQty(sumber.stok) : toQty(k.stokSumber);
        return {
          ...k,
          need,
          stok,
          cukup: hasEnoughStock(stok, need),
        };
      });
      const kgPerBatch = toQty(target.totalKgResep);
      const kgHasil = toQty(kgPerBatch * batch);
      const allCukup = rows.length > 0 && rows.every((r) => r.cukup);
      const maxBatch = target.maxBatchProduksi ?? 0;
      return (
        <div className="bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-xl p-4 space-y-3 shadow-sm">
          <h3 className="font-semibold text-[15px] text-purple-950 dark:text-purple-100">Isi Stok · {target.nama}</h3>
          <p className="text-sm text-purple-900 dark:text-purple-200">
            Bukan dari belanja supplier. Stok campuran diambil dari karung yang sudah ada di gudang, sesuai resep.
          </p>
          {resep.length === 0 ? (
            <p className="text-sm text-danger font-medium">Resep kosong. Edit produk dulu.</p>
          ) : (
            <>
              <p className="text-sm text-purple-900 dark:text-purple-200">
                1 batch: {resep.map((k) => `${k.sumberNama} ${formatKarungQty(k.qtyPerBatch)}`).join(" + ")}
                {kgPerBatch > 0 ? ` → ${formatQty(kgPerBatch)} kg` : ""}
              </p>
              <div>
                <label className="block text-sm font-medium mb-1 text-purple-950 dark:text-purple-100">Jumlah batch</label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setBukaKarungBatch(String(Math.max(1, batch - 1)))}
                    className="w-10 h-10 rounded-lg border border-purple-300 dark:border-purple-700 bg-white dark:bg-zinc-900 text-lg font-bold"
                    aria-label="Kurangi batch"
                  >
                    −
                  </button>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={bukaKarungBatch}
                    onChange={(e) => setBukaKarungBatch(digitsOnly(e.target.value) || "1")}
                    className="w-16 px-2 py-2.5 border border-purple-300 dark:border-purple-700 rounded-lg font-mono text-center bg-white dark:bg-zinc-900"
                    aria-label="Jumlah batch"
                  />
                  <button
                    type="button"
                    onClick={() => setBukaKarungBatch(String(batch + 1))}
                    className="w-10 h-10 rounded-lg border border-purple-300 dark:border-purple-700 bg-white dark:bg-zinc-900 text-lg font-bold"
                    aria-label="Tambah batch"
                  >
                    +
                  </button>
                  <span className="text-xs text-purple-800 dark:text-purple-300">
                    stok sekarang {formatQty(stockValue(target))} kg
                    {maxBatch > 0 ? ` · max ${maxBatch} batch` : ""}
                  </span>
                </div>
              </div>
              <ul className="text-sm space-y-1">
                {rows.map((r) => (
                  <li
                    key={r.sumberId}
                    className={r.cukup ? "text-purple-900 dark:text-purple-200" : "text-danger font-medium"}
                  >
                    {r.sumberNama}: −{formatKarungQty(r.need)} karung (sisa {formatQty(r.stok)}
                    {r.cukup ? "" : " — tidak cukup"})
                  </li>
                ))}
              </ul>
              <p className="text-sm font-semibold text-purple-950 dark:text-purple-100">
                Hasil: +{formatQty(kgHasil)} kg ke {target.nama}
                {kgHasil > 0 ? ` → ${formatQty(toQty(stockValue(target) + kgHasil))} kg` : ""}
              </p>
            </>
          )}
          {bukaKarungErr && <p className="text-danger text-sm font-medium">{bukaKarungErr}</p>}
          {bukaKarungMsg && <p className="text-primary text-sm font-medium">{bukaKarungMsg}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={async () => { await handleBukaKarung(bukaKarungId); }}
              disabled={bukaKarungSaving || resep.length === 0 || !allCukup}
              className="flex-1 bg-purple-700 dark:bg-purple-600 text-white py-3 rounded-lg font-semibold disabled:opacity-50"
            >
              {bukaKarungSaving ? "Mengisi..." : `Ya, Isi ${batch} Batch`}
            </button>
            <button
              type="button"
              onClick={() => { setBukaKarungId(null); setBukaKarungEceranId(""); setBukaKarungBatch("1"); setBukaKarungMsg(""); setBukaKarungErr(""); }}
              className="px-5 py-3 border border-purple-300 dark:border-purple-700 rounded-lg text-purple-900 dark:text-purple-100 font-medium bg-white dark:bg-zinc-900"
            >Batal</button>
          </div>
        </div>
      );
    }

    const karung = target;
    const eceranList = karung.eceranDariProduk || [];
    const tujuan = eceranList.find((e) => e.id === bukaKarungEceranId) || eceranList[0];
    return (
      <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl p-4 space-y-3 shadow-sm">
        <h3 className="font-semibold text-[15px] text-blue-950 dark:text-blue-100">Buka 1 Karung</h3>
        <p className="text-sm text-blue-900 dark:text-blue-200">
          Buka 1 <strong>{karung.nama}</strong> (stok: {formatQty(karung.stok)} karung) → tambah {karung.isiPerKarung ? formatQty(karung.isiPerKarung) : "25"} kg ke eceran tujuan.
        </p>
        {eceranList.length === 0 ? (
          <p className="text-sm text-danger font-medium">Belum ada produk eceran tertaut. Buat produk eceran dulu.</p>
        ) : eceranList.length === 1 ? (
          <p className="text-sm text-blue-900 dark:text-blue-200">Tujuan: <strong>{tujuan?.nama}</strong></p>
        ) : (
          <div>
            <label className="block text-sm font-medium mb-1 text-blue-950 dark:text-blue-100">Pilih eceran tujuan</label>
            <SearchSelect
              value={bukaKarungEceranId || tujuan?.id || ""}
              onChange={setBukaKarungEceranId}
              allowClear={false}
              placeholder="Pilih eceran..."
              options={eceranList.map((e) => ({ value: e.id, label: e.nama }))}
            />
          </div>
        )}
        {bukaKarungErr && <p className="text-danger text-sm font-medium">{bukaKarungErr}</p>}
        {bukaKarungMsg && <p className="text-primary text-sm font-medium">{bukaKarungMsg}</p>}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={async () => { await handleBukaKarung(bukaKarungId); }}
            disabled={bukaKarungSaving || eceranList.length === 0}
            className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-semibold disabled:opacity-50"
          >
            {bukaKarungSaving ? "Membuka..." : "Ya, Buka 1 Karung"}
          </button>
          <button
            type="button"
            onClick={() => { setBukaKarungId(null); setBukaKarungEceranId(""); setBukaKarungBatch("1"); setBukaKarungMsg(""); setBukaKarungErr(""); }}
            className="px-5 py-3 border border-blue-300 dark:border-blue-700 rounded-lg text-blue-900 dark:text-blue-100 font-medium bg-white dark:bg-zinc-900"
          >Batal</button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-wrap space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-start">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Master Produk</h2>
          <p className="text-sm text-muted-foreground">Karung diisi dari Pengeluaran. Gabungan diisi di sini lewat tombol Isi Stok (ambil dari karung).</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setShowImport((v) => !v);
              setShowForm(false);
              setSoMode(false);
              closeStock();
            }}
            className="px-3 py-2.5 rounded-lg text-sm font-semibold border border-border bg-surface"
          >
            Upload banyak
          </button>
          <button
            type="button"
            onClick={() => {
              setSoMode((v) => !v);
              setShowForm(false);
              setShowImport(false);
              setSoError("");
              setSoMsg("");
              closeStock();
            }}
            className={`px-3 py-2.5 rounded-lg text-sm font-semibold ${soMode ? "bg-amber-600 text-white" : "bg-amber-50 text-amber-900 border border-amber-200"}`}
          >
            Stock Opname
          </button>
          <button onClick={openAdd} className="btn-primary px-4 py-2.5 text-sm">
            + Tambah
          </button>
        </div>
      </div>

      <div className="relative">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari produk..."
          className="input-field pl-9"
        />
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm pointer-events-none">⌕</span>
      </div>
      {!loading && (
        <p className="text-xs text-muted-foreground -mt-2">
          {search.trim() ? `${filtered.length} dari ${active.length} produk` : `${active.length} produk`}
        </p>
      )}

      {showImport && (
        <div className="bg-white border border-border rounded-xl p-4 space-y-3.5 shadow-sm">
          <h3 className="font-semibold text-[15px]">Upload banyak produk</h3>
          <p className="text-xs text-muted-foreground">
            Tempel dari Excel atau unggah CSV. Kolom: <strong>PRODUK · SATUAN · JUMLAH · HPP · HARGA JUAL</strong>. Jumlah jadi stok awal.
          </p>
          <div className="flex flex-wrap gap-2">
            <label className="px-3 py-2 rounded-lg text-sm font-semibold border border-border cursor-pointer">
              Pilih file CSV
              <input type="file" accept=".csv,text/csv,text/plain" className="hidden" onChange={(e) => onPickFile(e.target.files?.[0])} />
            </label>
            <button type="button" onClick={downloadContoh} className="px-3 py-2 rounded-lg text-sm font-semibold border border-border">
              Unduh contoh
            </button>
          </div>
          <textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            rows={7}
            className="w-full px-3 py-2.5 border border-border rounded-lg font-mono text-sm"
            placeholder={"PRODUK\tSATUAN\tJUMLAH\tHPP\tHARGA JUAL\nBeras Pandan Wangi\tkg\t25\t12000\t15000"}
          />
          {importPreview.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {importOk.length} baris siap · {importBad.length} error
            </p>
          )}
          {importBad.length > 0 && (
            <ul className="text-xs text-danger space-y-0.5">
              {importBad.slice(0, 8).map((r) => (
                <li key={`${r.baris}-${r.nama}`}>
                  Baris {r.baris} {r.nama ? `· ${r.nama}` : ""}: {r.error}
                </li>
              ))}
            </ul>
          )}
          {importMsg && <p className="text-sm font-medium">{importMsg}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={handleImport} disabled={importSaving || importOk.length === 0} className="btn-primary flex-1 py-3 text-sm disabled:opacity-50">
              {importSaving ? "Mengimpor..." : `Impor ${importOk.length} produk`}
            </button>
            <button type="button" onClick={() => setShowImport(false)} className="px-5 py-3 border border-border rounded-lg text-muted-foreground font-medium">
              Tutup
            </button>
          </div>
        </div>
      )}

      {soMode && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3.5">
          <div>
            <h3 className="font-semibold text-[15px] text-amber-950">Stock Opname</h3>
            <p className="text-xs text-amber-900/80 mt-1">
              Isi <strong>stok fisik</strong> di tabel. Stok sistem <strong>diganti</strong> jadi angka itu. Contoh: awal 1, fisik 2 → stok jadi <strong>2</strong> (bukan 3).
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Alasan SO (wajib)</label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {ALASAN_SO.map((label) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setSoAlasan(label === "Lainnya" ? "" : label)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border ${
                    soAlasan === label ? "bg-amber-700 text-white border-amber-700" : "border-amber-200 bg-white"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={soAlasan}
              onChange={(e) => setSoAlasan(e.target.value)}
              className="w-full px-3 py-2.5 border border-amber-200 rounded-lg bg-white"
              placeholder="SO mingguan"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Atau tempel tabel (PRODUK · JUMLAH fisik)</label>
            <textarea
              value={soPaste}
              onChange={(e) => setSoPaste(e.target.value)}
              rows={3}
              className="w-full px-3 py-2.5 border border-amber-200 rounded-lg font-mono text-sm bg-white"
              placeholder={"PRODUK\tJUMLAH\nTelur\t2"}
            />
            <button type="button" onClick={applySoPaste} className="mt-2 px-3 py-2 rounded-lg text-xs font-semibold border border-amber-300 bg-white">
              Isi stok fisik dari tabel
            </button>
          </div>
          {soChanges.length > 0 && (
            <p className="text-sm font-semibold text-amber-950">{soChanges.length} produk akan diganti stoknya</p>
          )}
          {soError && <p className="text-sm font-medium text-danger">{soError}</p>}
          {soMsg && <p className="text-sm font-medium text-primary">{soMsg}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={handleSoMassal} disabled={soSaving} className="flex-1 bg-amber-700 text-white py-3 rounded-lg font-semibold disabled:opacity-50">
              {soSaving ? "Menyimpan SO..." : "Simpan Stock Opname"}
            </button>
            <button
              type="button"
              onClick={() => {
                setSoMode(false);
                setSoFisik({});
                setSoError("");
              }}
              className="px-5 py-3 border border-amber-300 rounded-lg text-amber-900 font-medium bg-white"
            >
              Batal
            </button>
          </div>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white border border-border rounded-xl p-4 space-y-3.5 shadow-sm">
          <h3 className="font-semibold text-[15px]">{editId ? "Edit Produk" : "Tambah Produk"}</h3>
          <div>
            <label className="block text-sm font-medium mb-1">Tipe Produk</label>
            <div className="grid grid-cols-3 gap-1.5">
              {([
                { value: "KARUNG" as TipeProduk, label: "Karungan", desc: "Stok karung" },
                { value: "ECERAN" as TipeProduk, label: "Eceran/Kg", desc: "Stok kg" },
                { value: "GABUNGAN" as TipeProduk, label: "Gabungan", desc: "Campuran kg" },
              ]).map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => {
                    setFormTipe(t.value);
                    if (t.value === "GABUNGAN") {
                      setForm((prev) => ({ ...prev, satuan: "kg" }));
                      setFormKomposisi((prev) => (prev.length ? prev : [{ sumberId: "", qtyPerBatch: "1" }]));
                    }
                  }}
                  className={`py-2.5 rounded-lg text-xs font-semibold border ${formTipe === t.value ? "bg-primary text-white border-primary" : "border-border text-muted-foreground"}`}
                >
                  <span className="block">{t.label}</span>
                  <span className="block text-[10px] opacity-70">{t.desc}</span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Nama Produk</label>
            <input
              type="text"
              value={form.nama}
              onChange={(e) => setForm({ ...form, nama: e.target.value })}
              required
              className="w-full px-3 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              placeholder={formTipe === "KARUNG" ? "Beras Pandan Wangi" : formTipe === "ECERAN" ? "Beras Ecer Pandan" : "Syalala (campuran)"}
            />
          </div>
          {formTipe !== "GABUNGAN" && (
          <div>
            <label className="block text-sm font-medium mb-1">Satuan</label>
            <SearchSelect
              value={form.satuan}
              onChange={(v) => setForm({ ...form, satuan: v || "kg" })}
              options={SATUAN.map((s) => ({ value: s.value, label: s.label }))}
              placeholder="Cari satuan..."
              allowClear={false}
            />
          </div>
          )}
          <div className={`grid gap-3 ${formTipe === "GABUNGAN" ? "grid-cols-1" : "grid-cols-2"}`}>
            {formTipe !== "GABUNGAN" && (
              <div>
                <label className="block text-sm font-medium mb-1">Harga Beli (Rp)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={formatRibuan(digitsOnly(form.hargaBeli))}
                  onChange={(e) => setForm({ ...form, hargaBeli: digitsOnly(e.target.value) })}
                  required
                  className="w-full px-3 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary font-mono"
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium mb-1">
                {formTipe === "GABUNGAN" ? "Harga Jual per kg (Rp)" : "Harga Jual (Rp)"}
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={formatRibuan(digitsOnly(form.hargaJual))}
                onChange={(e) => setForm({ ...form, hargaJual: digitsOnly(e.target.value) })}
                required
                className="w-full px-3 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary font-mono"
              />
            </div>
          </div>

          {formTipe === "GABUNGAN" && (
            <div className="rounded-lg border border-purple-200 bg-purple-50 px-3 py-2.5 space-y-1">
              <p className="text-sm font-medium text-purple-900">HPP per kg (otomatis dari resep)</p>
              <p className="font-mono text-[15px] font-semibold text-purple-800">
                {hargaBeliGabunganPreview > 0 ? `${formatRupiah(hargaBeliGabunganPreview)} / kg` : "— isi resep dulu"}
              </p>
              {hppGabunganPreview.totalKg > 0 && (
                <p className="text-[11px] text-purple-800">
                  Modal {formatRupiah(hppGabunganPreview.totalBiaya)} ÷ {formatQty(hppGabunganPreview.totalKg)} kg
                </p>
              )}
              <p className="text-[11px] text-purple-700/80 dark:text-purple-300/80">
                Campuran kelipatan ½ karung. Contoh: A 1 + B 1 + C ½ karung (25 kg) = 62,5 kg → Rp 250.000 / 62,5 kg.
              </p>
              <p className="text-[11px] text-purple-800 dark:text-purple-200">
                Simpan resep saja — stok karung tidak berkurang. Stok campuran diisi nanti lewat tombol <strong>Isi Stok</strong> (ambil dari karung).
              </p>
            </div>
          )}

          {/* KARUNG: isi per karung */}
          {formTipe === "KARUNG" && (
            <div>
              <label className="block text-sm font-medium mb-1">Isi per Karung (kg)</label>
              <input
                type="text"
                inputMode="numeric"
                value={formIsiPerKarung}
                onChange={(e) => setFormIsiPerKarung(digitsOnly(e.target.value))}
                className="w-full px-3 py-2.5 border border-border rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="25"
              />
              <p className="text-[11px] text-muted-foreground mt-1">Berapa kg beras dalam 1 karung</p>
            </div>
          )}

          {/* ECERAN: pilih sumber karung */}
          {formTipe === "ECERAN" && (
            <div>
              <label className="block text-sm font-medium mb-1">Sumber Karung</label>
              <SearchSelect
                value={formSumberId}
                onChange={setFormSumberId}
                required
                placeholder="Cari produk karung..."
                options={karungList.map((k) => ({
                  value: k.id,
                  label: k.nama,
                  description: `stok ${formatQty(k.stok)} karung`,
                }))}
              />
              <p className="text-[11px] text-muted-foreground mt-1">Saat stok eceran habis, buka karung manual dari sini</p>
            </div>
          )}

          {/* GABUNGAN: resep komposisi */}
          {formTipe === "GABUNGAN" && (
            <div>
              <label className="block text-sm font-medium mb-1">Resep Campuran</label>
              <p className="text-[11px] text-muted-foreground mb-2">Pilih beras karung + jumlah (kelipatan ½ karung). Ini formula, bukan pemakaian stok.</p>
              <div className="space-y-2">
                {formKomposisi.map((k, i) => {
                  const sumber = karungList.find((kr) => kr.id === k.sumberId);
                  const qty = parseQtyInput(k.qtyPerBatch);
                  const qtyOk = Number.isFinite(qty) && isKelipatanSetengahKarung(qty);
                  return (
                  <div key={i} className="space-y-1">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                      <SearchSelect
                        className="flex-1 min-w-0 sm:min-w-[200px]"
                        value={k.sumberId}
                        onChange={(v) => {
                          const next = [...formKomposisi];
                          next[i] = { ...next[i], sumberId: v };
                          setFormKomposisi(next);
                        }}
                        placeholder="Cari karung..."
                        options={karungList.map((kr) => ({
                          value: kr.id,
                          label: kr.nama,
                          description: `${formatRupiah(kr.hppRataRata > 0 ? kr.hppRataRata : kr.hargaBeli)}/karung · ${formatQty(kr.isiPerKarung || 25)} kg`,
                        }))}
                      />
                      <div className="flex items-center gap-1.5 sm:gap-1">
                        <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            const next = [...formKomposisi];
                            next[i] = { ...next[i], qtyPerBatch: String(langkahKarung(qtyOk ? qty : 1, -1)) };
                            setFormKomposisi(next);
                          }}
                          className="w-8 h-8 rounded-lg border border-border bg-muted text-sm font-bold"
                          aria-label="Kurangi setengah karung"
                        >
                          −
                        </button>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={k.qtyPerBatch}
                          onChange={(e) => {
                            const next = [...formKomposisi];
                            next[i] = { ...next[i], qtyPerBatch: sanitizeQtyInput(e.target.value) };
                            setFormKomposisi(next);
                          }}
                          className="w-14 px-1 py-2 border border-border rounded-lg font-mono text-sm text-center"
                          placeholder="1"
                          aria-label="Jumlah karung"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const next = [...formKomposisi];
                            next[i] = { ...next[i], qtyPerBatch: String(langkahKarung(qtyOk ? qty : 0.5, 1)) };
                            setFormKomposisi(next);
                          }}
                          className="w-8 h-8 rounded-lg border border-border bg-muted text-sm font-bold"
                          aria-label="Tambah setengah karung"
                        >
                          +
                        </button>
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {qtyOk ? formatKarungQty(qty) : "—"} karung
                      </span>
                      <button
                        type="button"
                        onClick={() => setFormKomposisi(formKomposisi.filter((_, j) => j !== i))}
                        className="text-danger text-sm font-bold px-1"
                      >×</button>
                    </div>
                    </div>
                    {k.qtyPerBatch && !qtyOk && (
                      <p className="text-[11px] text-danger">Pakai ½, 1, 1½, 2, … karung</p>
                    )}
                    {sumber && qtyOk && (
                      <p className="text-[11px] text-muted-foreground">
                        {formatQty(toQty(sumber.isiPerKarung || 25) * qty)} kg · modal {formatRupiah(Math.round((sumber.hppRataRata > 0 ? sumber.hppRataRata : sumber.hargaBeli) * qty))}
                      </p>
                    )}
                  </div>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={() => setFormKomposisi([...formKomposisi, { sumberId: "", qtyPerBatch: "1" }])}
                className="mt-2 text-primary text-sm font-medium hover:underline"
              >+ Tambah Komponen</button>
            </div>
          )}

          {error && <p className="text-danger text-sm font-medium">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button type="submit" className="flex-1 bg-primary text-white py-3 rounded-lg font-semibold hover:bg-primary-hover active:bg-primary-hover/80 transition-colors shadow-sm">
              Simpan
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="px-5 py-3 border border-border rounded-lg text-muted-foreground font-medium hover:bg-muted active:bg-border transition-colors">
              Batal
            </button>
          </div>
        </form>
      )}

      {stockMode && selected && (
        <div className="bg-white border border-border rounded-xl p-4 space-y-3.5 shadow-sm">
          <h3 className="font-semibold text-[15px]">
            {stockMode === "isi" && `Isi Stok · ${selected.nama}`}
            {stockMode === "kurang" && `Kurangi Stok · ${selected.nama}`}
            {stockMode === "pindah" && `Pindah Stok · ${selected.nama}`}
            {stockMode === "adjust" && `Penyesuaian SO · ${selected.nama}`}
          </h3>
          <p className="text-xs text-muted-foreground">
            Stok sistem: <strong>{formatQty(selected.stok)} {selected.satuan}</strong>
          </p>
          {stockMode === "isi" && (
            <p className="text-xs text-muted-foreground">
              Setelah produk & barcode dibuat, isi jumlah di sini. Nama produk sudah terpilih otomatis.
            </p>
          )}
          {stockMode === "pindah" && (
            <p className="text-xs text-muted-foreground">
              Untuk beras karungan yang dipecah jadi eceran. Stok karung berkurang, stok eceran bertambah. Harga tetap terpisah.
            </p>
          )}
          {stockMode === "adjust" && (
            <p className="text-xs text-muted-foreground">
              Isi <strong>stok fisik hasil hitung</strong>. Angka ini <strong>mengganti</strong> stok, bukan ditambah. Contoh: stok 1, hitung 2 → stok jadi 2.
            </p>
          )}
          <div>
            <label className="block text-sm font-medium mb-1">
              {stockMode === "pindah"
                ? `Jumlah dikurangi (${selected.satuan})`
                : stockMode === "adjust"
                  ? `Stok akan diganti menjadi (${selected.satuan})`
                  : `Jumlah (${selected.satuan})`}
            </label>
            <input
              type="text"
              inputMode={allowsFractionQty(selected) ? "decimal" : "numeric"}
              value={stockJumlah}
              onChange={(e) =>
                setStockJumlah(allowsFractionQty(selected) ? sanitizeQtyInput(e.target.value) : digitsOnly(e.target.value))
              }
              className="w-full px-3 py-2.5 border border-border rounded-lg font-mono"
              placeholder={
                stockMode === "adjust"
                  ? allowsFractionQty(selected)
                    ? "Contoh: 0,7"
                    : "Hasil hitung SO"
                  : allowsFractionQty(selected)
                    ? "Contoh: 0,7 atau 10"
                    : "Contoh: 25"
              }
            />
            {allowsFractionQty(selected) && (
              <p className="text-[11px] text-muted-foreground mt-1">Telur boleh pecahan: 0,7 · 1/4 · 1/3 · 1/2 kg.</p>
            )}
          </div>
          {stockMode === "adjust" && Number.isFinite(adjustSelisih) && (
            <div
              className={`rounded-xl px-3 py-2.5 text-sm font-semibold ${
                adjustSelisih === 0
                  ? "bg-muted text-muted-foreground"
                  : adjustSelisih > 0
                    ? "bg-primary-soft text-primary"
                    : "bg-danger-soft text-danger"
              }`}
            >
              {adjustSelisih === 0
                ? "Stok fisik sama dengan sistem — tidak perlu disesuaikan"
                : `Stok ${formatQty(selected.stok)} → ${formatQty(adjustFisik)} ${selected.satuan} (diganti, selisih ${adjustSelisih > 0 ? "+" : ""}${formatQty(adjustSelisih)})`}
            </div>
          )}
          {stockMode === "isi" && (
            <>
              <div>
                <label className="block text-sm font-medium mb-1">Harga beli satuan (opsional, untuk HPP)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={formatRibuan(stockHarga)}
                  onChange={(e) => setStockHarga(digitsOnly(e.target.value))}
                  className="w-full px-3 py-2.5 border border-border rounded-lg font-mono"
                  placeholder="Hanya untuk rata-rata HPP, bukan pengeluaran"
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Isi stok hanya menambah barang di gudang. Kalau ini belanja supplier, catat di <strong>Pengeluaran → Restock</strong> — stok sudah naik otomatis dari sana, jangan isi stok lagi.
                </p>
              </div>
            </>
          )}
          {stockMode === "kurang" && (
            <div>
              <label className="block text-sm font-medium mb-1">Alasan (opsional)</label>
              <input
                type="text"
                value={stockCatatan}
                onChange={(e) => setStockCatatan(e.target.value)}
                className="w-full px-3 py-2.5 border border-border rounded-lg"
                placeholder="Rusak, sampel, pecah karung, dll"
              />
            </div>
          )}
          {stockMode === "adjust" && (
            <div>
              <label className="block text-sm font-medium mb-1">Alasan penyesuaian (wajib)</label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {ALASAN_SO.map((label) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setStockCatatan(label === "Lainnya" ? "" : label)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border ${
                      stockCatatan === label ? "bg-primary text-white border-primary" : "border-border bg-muted/70"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={stockCatatan}
                onChange={(e) => setStockCatatan(e.target.value)}
                className="w-full px-3 py-2.5 border border-border rounded-lg"
                placeholder="Contoh: SO minggu ke-2, kurang 2 kg karena pecah"
                required
              />
            </div>
          )}
          {stockMode === "pindah" && (
            <>
              <div className="space-y-2">
                <label className="block text-sm font-medium">Pindah ke produk</label>
                <div className="flex gap-2 items-start">
                  <SearchSelect
                    className="flex-1 min-w-0"
                    value={pindahKe}
                    onChange={setPindahKe}
                    placeholder="Cari produk tujuan..."
                    options={tujuanList.map((p) => ({
                      value: p.id,
                      label: p.nama,
                      description: `stok ${formatQty(p.stok)} ${p.satuan}`,
                    }))}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (showPindahScanner) {
                        stopPindahScanner();
                        setShowPindahScanner(false);
                      } else {
                        setShowPindahScanner(true);
                      }
                    }}
                    className={`shrink-0 px-3.5 py-2.5 rounded-lg font-semibold text-sm border transition-colors ${
                      showPindahScanner
                        ? "bg-danger text-white border-danger"
                        : "bg-primary text-white border-primary"
                    }`}
                  >
                    {showPindahScanner ? "Tutup" : "Scan"}
                  </button>
                </div>
                {pindahTujuanSelected && (
                  <div className="rounded-lg bg-primary-soft/50 border border-primary/20 px-3 py-2 text-sm">
                    Tujuan: <strong>{pindahTujuanSelected.nama}</strong>
                    <span className="text-muted-foreground font-mono">
                      {" "}
                      · stok {formatQty(pindahTujuanSelected.stok)} {pindahTujuanSelected.satuan}
                    </span>
                  </div>
                )}
                {showPindahScanner && (
                  <div className="border border-border rounded-xl overflow-hidden p-3 space-y-2 bg-muted/30">
                    <p className="text-sm font-semibold text-center">Arahkan kamera ke barcode tujuan</p>
                    <div id="pindah-barcode-reader" className="rounded-xl overflow-hidden bg-black/80 min-h-[200px]" />
                    {pindahScanError && (
                      <p className="text-sm text-danger font-medium text-center">{pindahScanError}</p>
                    )}
                    {pindahScanHint && !pindahScanError && (
                      <p className="text-sm text-amber-700 font-medium text-center">{pindahScanHint}</p>
                    )}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Jumlah ditambahkan ke tujuan</label>
                <input
                  type="text"
                  inputMode={pindahTujuanSelected && allowsFractionQty(pindahTujuanSelected) ? "decimal" : "numeric"}
                  value={pindahJumlahKe}
                  onChange={(e) => {
                    setPindahJumlahKe(
                      pindahTujuanSelected && allowsFractionQty(pindahTujuanSelected)
                        ? sanitizeQtyInput(e.target.value)
                        : digitsOnly(e.target.value)
                    );
                  }}
                  className="w-full px-3 py-2.5 border border-border rounded-lg font-mono"
                  placeholder="Contoh: 25 (jika 1 karung = 25 kg)"
                />
              </div>
            </>
          )}
          {stockError && <p className="text-danger text-sm font-medium">{stockError}</p>}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={handleStock} disabled={stockSaving} className="flex-1 bg-primary text-white py-3 rounded-lg font-semibold disabled:opacity-50">
              {stockSaving ? "Menyimpan..." : stockMode === "adjust" ? "Simpan Penyesuaian" : "Simpan Stok"}
            </button>
            <button type="button" onClick={closeStock} className="px-5 py-3 border border-border rounded-lg text-muted-foreground font-medium">
              Batal
            </button>
          </div>
        </div>
      )}

      {renderBukaKarungPanel()}

      {loading ? (
        <div className="text-center py-10">
          <div className="inline-block w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground text-sm mt-2">Memuat...</p>
        </div>
      ) : produk.length === 0 ? (
        <div className="text-center py-10 bg-surface border border-dashed border-border rounded-xl">
          <p className="text-muted-foreground text-sm">Belum ada produk</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-10 bg-surface border border-dashed border-border rounded-xl">
          <p className="text-muted-foreground text-sm">Tidak ada produk bernama “{search.trim()}”</p>
        </div>
      ) : (
        <>
          <div className="md:hidden space-y-2">
            {filtered.map((p) => {
              const stok = stockValue(p);
              return (
                <div key={p.id} className="card-surface p-3.5 space-y-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="font-semibold text-[15px] leading-snug">{p.nama}</p>
                        {p.tipe === "KARUNG" && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">Karung</span>
                        )}
                        {p.tipe === "ECERAN" && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-green-100 text-green-700">Ecer</span>
                        )}
                        {p.tipe === "GABUNGAN" && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-purple-100 text-purple-700">Gabungan</span>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {formatRupiah(p.hargaJual)} / {p.satuan} · beli {formatRupiah(p.hargaBeli)}
                        {p.tipe === "GABUNGAN" ? "/kg" : ""}
                      </p>
                      {p.tipe === "KARUNG" && p.isiPerKarung && (
                        <p className="text-[11px] text-blue-600">1 karung = {formatQty(p.isiPerKarung)} kg</p>
                      )}
                      {p.tipe === "ECERAN" && p.sumberProdukNama && (
                        <p className="text-[11px] text-green-600">← {p.sumberProdukNama}</p>
                      )}
                      {p.tipe === "GABUNGAN" && p.komposisi && p.komposisi.length > 0 && (
                        <p className="text-[11px] text-purple-600">
                          {p.komposisi.map((k) => `${k.sumberNama} ${formatKarungQty(k.qtyPerBatch)}`).join(" + ")}
                          {p.totalKgResep ? ` · ${formatQty(p.totalKgResep)} kg` : ""}
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Stok</p>
                      <p className={`font-mono font-bold ${stok <= 0 ? "text-danger" : stok < 10 ? "text-warning" : "text-primary"}`}>
                        {formatQty(stok)} {p.satuan}
                      </p>
                      {p.tipe === "GABUNGAN" && gabunganStokHint(p, stok) && (
                        <p className="text-[10px] text-purple-700 dark:text-purple-300">
                          {gabunganStokHint(p, stok)}
                        </p>
                      )}
                    </div>
                  </div>
                  {soMode ? (
                    <div>
                      <label className="text-[11px] font-medium">Stok fisik (jadi)</label>
                      <input
                        type="text"
                        inputMode={allowsFractionQty(p) ? "decimal" : "numeric"}
                        value={soFisik[p.id] ?? ""}
                        onChange={(e) =>
                          setSoFisik((prev) => ({
                            ...prev,
                            [p.id]: allowsFractionQty(p) ? sanitizeQtyInput(e.target.value) : digitsOnly(e.target.value),
                          }))
                        }
                        placeholder={formatQty(p.stok)}
                        className="mt-1 w-full px-3 py-2.5 border border-amber-300 rounded-xl font-mono text-right bg-surface min-h-11"
                      />
                    </div>
                  ) : (
                    <ProductActions p={p} />
                  )}
                </div>
              );
            })}
          </div>

          <div className="hidden md:block card-surface overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[720px]">
                <thead>
                  <tr className="bg-muted/70 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th className="px-3 py-2.5 font-semibold">Produk</th>
                    <th className="px-3 py-2.5 font-semibold">Satuan</th>
                    <th className="px-3 py-2.5 font-semibold text-right">Harga jual</th>
                    <th className="px-3 py-2.5 font-semibold text-right">Stok sistem</th>
                    {soMode ? (
                      <th className="px-3 py-2.5 font-semibold text-right">Stok fisik (jadi)</th>
                    ) : (
                      <th className="px-3 py-2.5 font-semibold text-right">Aksi</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => {
                    const stok = stockValue(p);
                    return (
                      <tr key={p.id} className="border-t border-border hover:bg-muted/40">
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="font-semibold text-[13px]">{p.nama}</p>
                            {p.tipe === "KARUNG" && (
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">Karung</span>
                            )}
                            {p.tipe === "ECERAN" && (
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-green-100 text-green-700">Ecer</span>
                            )}
                            {p.tipe === "GABUNGAN" && (
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-purple-100 text-purple-700">Gabungan</span>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground">
                            Beli {formatRupiah(p.hargaBeli)}
                            {p.tipe === "GABUNGAN" ? "/kg" : ""}
                          </p>
                          {p.tipe === "KARUNG" && p.isiPerKarung && (
                            <p className="text-[11px] text-blue-600">1 karung = {formatQty(p.isiPerKarung)} kg</p>
                          )}
                          {p.tipe === "ECERAN" && p.sumberProdukNama && (
                            <p className="text-[11px] text-green-600">← {p.sumberProdukNama}</p>
                          )}
                          {p.tipe === "GABUNGAN" && p.komposisi && p.komposisi.length > 0 && (
                            <p
                              className="text-[11px] text-purple-600 truncate"
                              title={p.komposisi.map((k) => `${k.sumberNama} ${formatKarungQty(k.qtyPerBatch)} karung`).join(" + ")}
                            >
                              {p.komposisi.map((k) => `${k.sumberNama} ${formatKarungQty(k.qtyPerBatch)}`).join(" + ")}
                              {p.totalKgResep ? ` · ${formatQty(p.totalKgResep)} kg` : ""}
                            </p>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-muted-foreground">{p.satuan}</td>
                        <td className="px-3 py-2.5 text-right font-mono">{formatRupiah(p.hargaJual)}</td>
                        <td className={`px-3 py-2.5 text-right font-mono font-bold ${stok <= 0 ? "text-danger" : stok < 10 ? "text-warning" : "text-primary"}`}>
                          <span title={p.tipe === "GABUNGAN" ? "Stok campuran siap jual (independen dari karung)" : undefined}>
                            {formatQty(stok)}
                          </span>
                          {p.tipe === "GABUNGAN" && gabunganStokHint(p, stok) && (
                            <p className="text-[10px] font-medium text-purple-700 dark:text-purple-300">
                              {gabunganStokHint(p, stok)}
                            </p>
                          )}
                        </td>
                        {soMode ? (
                          <td className="px-3 py-2.5">
                            <input
                              type="text"
                              inputMode={allowsFractionQty(p) ? "decimal" : "numeric"}
                              value={soFisik[p.id] ?? ""}
                              onChange={(e) =>
                                setSoFisik((prev) => ({
                                  ...prev,
                                  [p.id]: allowsFractionQty(p) ? sanitizeQtyInput(e.target.value) : digitsOnly(e.target.value),
                                }))
                              }
                              placeholder={formatQty(p.stok)}
                              className="w-24 ml-auto block px-2 py-1.5 border border-amber-300 rounded-md font-mono text-right bg-surface"
                            />
                          </td>
                        ) : (
                          <td className="px-3 py-2.5">
                            <div className="flex justify-end">
                              <ProductActions p={p} />
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <div className="space-y-2.5">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h3 className="font-semibold text-[15px]">Riwayat penyesuaian SO</h3>
            <p className="text-xs text-muted-foreground">Alasan tiap adjustment tersimpan di sini.</p>
          </div>
        </div>
        <input
          type="search"
          value={historySearch}
          onChange={(e) => setHistorySearch(e.target.value)}
          placeholder="Cari riwayat (produk / alasan / user)..."
          className="input-field py-2.5 text-sm"
        />
        {filteredHistory.length === 0 ? (
          <div className="text-center py-8 bg-white border border-dashed border-border rounded-xl">
            <p className="text-muted-foreground text-sm">
              {adjustments.length === 0 ? "Belum ada penyesuaian stok" : "Tidak ada riwayat yang cocok"}
            </p>
          </div>
        ) : (
          <div className="card-surface overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[680px]">
                <thead>
                  <tr className="bg-muted/70 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th className="px-3 py-2.5 font-semibold">Tanggal</th>
                    <th className="px-3 py-2.5 font-semibold">Produk</th>
                    <th className="px-3 py-2.5 font-semibold text-right">Sistem → Fisik</th>
                    <th className="px-3 py-2.5 font-semibold text-right">Selisih</th>
                    <th className="px-3 py-2.5 font-semibold">Alasan</th>
                    <th className="px-3 py-2.5 font-semibold">Oleh</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHistory.map((row) => (
                    <tr key={row.id} className="border-t border-border align-top">
                      <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(row.createdAt).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td className="px-3 py-2.5 font-medium">{row.produkNama}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-xs whitespace-nowrap">
                        {formatQty(row.stokSistem)} → {formatQty(row.stokFisik)} {row.satuan}
                      </td>
                      <td className={`px-3 py-2.5 text-right font-mono font-semibold ${row.selisih > 0 ? "text-primary" : "text-danger"}`}>
                        {row.selisih > 0 ? "+" : ""}
                        {formatQty(row.selisih)}
                      </td>
                      <td className="px-3 py-2.5 text-[13px]">{row.alasan}</td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">{row.createdByUsername}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
