import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session.userId || session.role !== "OWNER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const { nama, satuan, hargaBeli, hargaJual } = await request.json();

  const produk = await prisma.produk.update({
    where: { id },
    data: { nama, satuan, hargaBeli, hargaJual },
  });
  return NextResponse.json(produk);
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session.userId || session.role !== "OWNER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  await prisma.produk.update({
    where: { id },
    data: { aktif: false },
  });
  return NextResponse.json({ success: true });
}
