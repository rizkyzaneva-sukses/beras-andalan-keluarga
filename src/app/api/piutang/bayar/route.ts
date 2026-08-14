import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { writeAudit } from "@/lib/audit";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { piutangId, jumlah, metodeBayar } = await request.json();
  if (!piutangId || !jumlah || jumlah <= 0) {
    return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
  }
  const metode = metodeBayar === "TRANSFER" || metodeBayar === "QRIS" ? metodeBayar : "CASH";

  const piutang = await prisma.piutang.findUnique({
    where: { id: piutangId },
    include: { pembayaran: true },
  });
  if (!piutang) return NextResponse.json({ error: "Data tidak ditemukan" }, { status: 404 });

  const sudahDibayar = piutang.pembayaran.reduce((s, b) => s + b.jumlah, 0);
  if (sudahDibayar + jumlah > piutang.total) {
    return NextResponse.json({ error: "Jumlah pembayaran melebihi sisa hutang" }, { status: 400 });
  }

  const bayar = await prisma.pembayaranPiutang.create({
    data: {
      piutangId,
      jumlah,
      tanggal: new Date(),
      metodeBayar: metode,
      createdBy: session.userId,
    },
  });

  await prisma.piutang.update({
    where: { id: piutangId },
    data: { sudahDibayar: sudahDibayar + jumlah },
  });

  await writeAudit({
    entityType: "PIUTANG",
    entityId: bayar.id,
    action: "CREATE",
    newData: {
      namaPelanggan: piutang.namaPelanggan,
      jumlah,
      metodeBayar: metode,
      tanggal: bayar.tanggal,
    },
    userId: session.userId,
  });

  return NextResponse.json({ data: bayar }, { status: 201 });
}
