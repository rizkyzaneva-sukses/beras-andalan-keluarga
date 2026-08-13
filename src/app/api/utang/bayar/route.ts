import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { writeAudit } from "@/lib/audit";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.userId || session.role !== "OWNER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  const { pembelanjaanId, jumlah } = await request.json();
  if (!pembelanjaanId || !jumlah || jumlah <= 0) {
    return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
  }
  const utang = await prisma.pembelanjaan.findUnique({ where: { id: pembelanjaanId }, include: { pembayaranUtang: true } });
  if (!utang) return NextResponse.json({ error: "Data tidak ditemukan" }, { status: 404 });
  const sudahDibayar = utang.pembayaranUtang.reduce((s, b) => s + b.jumlah, 0);
  if (sudahDibayar + jumlah > utang.total) {
    return NextResponse.json({ error: "Jumlah pembayaran melebihi sisa utang" }, { status: 400 });
  }
  const bayar = await prisma.pembayaranUtang.create({
    data: { pembelanjaanId, jumlah, tanggal: new Date(), createdBy: session.userId },
  });
  await writeAudit({
    entityType: "UTANG",
    entityId: bayar.id,
    action: "CREATE",
    newData: { namaBarang: utang.namaBarang, jumlah, tanggal: bayar.tanggal },
    userId: session.userId,
  });
  return NextResponse.json({ data: bayar }, { status: 201 });
}
