import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { writeAudit } from "@/lib/audit";
import { toQty } from "@/lib/qty";

export async function GET() {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const produk = await prisma.produk.findMany({
    where: { aktif: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(produk.map((p) => ({ ...p, stok: toQty(p.stok) })));
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.userId || session.role !== "OWNER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { nama, satuan, hargaBeli, hargaJual } = await request.json();
  if (!nama || !satuan || !hargaBeli || !hargaJual) {
    return NextResponse.json({ error: "Semua field wajib diisi" }, { status: 400 });
  }

  const produk = await prisma.produk.create({
    data: { nama, satuan, hargaBeli, hargaJual },
  });
  await writeAudit({
    entityType: "PRODUK",
    entityId: produk.id,
    action: "CREATE",
    newData: { nama, satuan, hargaBeli, hargaJual },
    userId: session.userId,
  });
  return NextResponse.json(produk, { status: 201 });
}
