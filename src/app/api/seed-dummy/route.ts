import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import bcrypt from "bcryptjs";

export async function POST() {
  const session = await getSession();
  if (!session.userId || session.role !== "OWNER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  await prisma.pembayaranPiutang.deleteMany();
  await prisma.pembayaranUtang.deleteMany();
  await prisma.penjualan.deleteMany();
  await prisma.piutang.deleteMany();
  await prisma.pembelanjaan.deleteMany();
  await prisma.modalLog.deleteMany();
  await prisma.produk.deleteMany();
  await prisma.user.deleteMany({ where: { username: { not: "owner" } } });

  const kasirUser = await prisma.user.create({
    data: {
      username: "kasir",
      passwordHash: await bcrypt.hash("kasir123", 10),
      role: "KASIR",
    },
  });

  const [p1, p2, p3, p4, p5] = await Promise.all([
    prisma.produk.create({ data: { nama: "Beras Pandan Wangi", satuan: "kg", hargaBeli: 12000, hargaJual: 15000 } }),
    prisma.produk.create({ data: { nama: "Beras IR 64", satuan: "kg", hargaBeli: 10000, hargaJual: 13000 } }),
    prisma.produk.create({ data: { nama: "Beras Merah Organik", satuan: "kg", hargaBeli: 14000, hargaJual: 18000 } }),
    prisma.produk.create({ data: { nama: "Beras Ketan Putih", satuan: "liter", hargaBeli: 15000, hargaJual: 20000 } }),
    prisma.produk.create({ data: { nama: "Beras Premium Ramos", satuan: "kg", hargaBeli: 16000, hargaJual: 21000 } }),
  ]);

  const now = new Date();
  const d = (offset: number) => {
    const date = new Date(now);
    date.setDate(date.getDate() - offset);
    date.setHours(0, 0, 0, 0);
    return date;
  };

  const penjualanData = [
    { tanggal: d(2), produkId: p1.id, qty: 5, hargaJual: 15000, total: 75000, metodeBayar: "CASH" as const, hargaDisesuaikan: false, createdBy: kasirUser.id },
    { tanggal: d(2), produkId: p2.id, qty: 3, hargaJual: 13000, total: 39000, metodeBayar: "TRANSFER" as const, hargaDisesuaikan: false, createdBy: kasirUser.id },
    { tanggal: d(2), produkId: p3.id, qty: 2, hargaJual: 18000, total: 36000, metodeBayar: "CASH" as const, hargaDisesuaikan: false, createdBy: kasirUser.id },
    { tanggal: d(2), produkId: p1.id, qty: 8, hargaJual: 15000, total: 120000, metodeBayar: "CASH" as const, hargaDisesuaikan: false, createdBy: session.userId },
    { tanggal: d(1), produkId: p1.id, qty: 10, hargaJual: 15000, total: 150000, metodeBayar: "CASH" as const, hargaDisesuaikan: false, createdBy: kasirUser.id },
    { tanggal: d(1), produkId: p2.id, qty: 4, hargaJual: 13000, total: 52000, metodeBayar: "CASH" as const, hargaDisesuaikan: false, createdBy: kasirUser.id },
    { tanggal: d(1), produkId: p4.id, qty: 3, hargaJual: 20000, total: 60000, metodeBayar: "TRANSFER" as const, hargaDisesuaikan: false, createdBy: kasirUser.id },
    { tanggal: d(1), produkId: p5.id, qty: 2, hargaJual: 18000, hargaDisesuaikan: true, total: 36000, metodeBayar: "CASH" as const, createdBy: session.userId },
    { tanggal: d(1), produkId: p2.id, qty: 12, hargaJual: 13000, total: 156000, metodeBayar: "TRANSFER" as const, hargaDisesuaikan: false, createdBy: session.userId },
    { tanggal: d(0), produkId: p1.id, qty: 3, hargaJual: 15000, total: 45000, metodeBayar: "CASH" as const, hargaDisesuaikan: false, createdBy: kasirUser.id },
    { tanggal: d(0), produkId: p3.id, qty: 2, hargaJual: 18000, total: 36000, metodeBayar: "CASH" as const, hargaDisesuaikan: false, createdBy: kasirUser.id },
    { tanggal: d(0), produkId: p5.id, qty: 1, hargaJual: 21000, total: 21000, metodeBayar: "TRANSFER" as const, hargaDisesuaikan: false, createdBy: session.userId },
    { tanggal: d(0), produkId: p2.id, qty: 5, hargaJual: 12500, hargaDisesuaikan: true, total: 62500, metodeBayar: "CASH" as const, createdBy: kasirUser.id },
  ];

  const pembelanjaanData = [
    { tanggal: d(2), kategori: "RESTOCK" as const, namaBarang: "Beras Pandan Wangi 50kg (Supplier A)", jumlah: 2, harga: 600000, total: 1200000, createdBy: session.userId },
    { tanggal: d(2), kategori: "OPERASIONAL" as const, namaBarang: "Kantong plastik 1 pak", jumlah: 1, harga: 45000, total: 45000, createdBy: session.userId },
    { tanggal: d(1), kategori: "RESTOCK" as const, namaBarang: "Beras IR 64 25kg", jumlah: 4, harga: 250000, total: 1000000, createdBy: session.userId },
    { tanggal: d(1), kategori: "LAINNYA" as const, namaBarang: "Biaya transport & parkir", jumlah: 1, harga: 50000, total: 50000, createdBy: session.userId },
    { tanggal: d(1), kategori: "OPERASIONAL" as const, namaBarang: "Tagihan listrik & air", jumlah: 1, harga: 350000, total: 350000, createdBy: session.userId },
    { tanggal: d(0), kategori: "RESTOCK" as const, namaBarang: "Beras Merah Organik 10kg", jumlah: 3, harga: 140000, total: 420000, createdBy: session.userId },
    { tanggal: d(0), kategori: "LAINNYA" as const, namaBarang: "Konsumsi karyawan", jumlah: 1, harga: 30000, total: 30000, createdBy: session.userId },
    { tanggal: d(5), kategori: "RESTOCK" as const, namaBarang: "Beras Premium Ramos 25kg", jumlah: 5, harga: 400000, total: 2000000, createdBy: session.userId },
    { tanggal: d(6), kategori: "OPERASIONAL" as const, namaBarang: "Perbaikan timbangan", jumlah: 1, harga: 150000, total: 150000, createdBy: session.userId },
  ];

  for (const p of penjualanData) {
    await prisma.penjualan.create({ data: p });
  }
  for (const p of pembelanjaanData) {
    await prisma.pembelanjaan.create({ data: p });
  }

  await prisma.modalLog.createMany({
    data: [
      { jumlah: 5000000, tanggal: d(30), keterangan: "Modal awal usaha", createdBy: session.userId },
      { jumlah: 3000000, tanggal: d(15), keterangan: "Top-up modal — tambahan stok lebaran", createdBy: session.userId },
      { jumlah: 2000000, tanggal: d(7), keterangan: "Top-up modal — renovasi etalase", createdBy: session.userId },
    ],
  });

  return NextResponse.json({
    success: true,
    message: "Data dummy siap! 5 produk, 13 penjualan (3 hari), 9 pembelanjaan, 3 modal (total Rp 10jt). Cek Dashboard pilih 'Minggu Ini'.",
  });
}
