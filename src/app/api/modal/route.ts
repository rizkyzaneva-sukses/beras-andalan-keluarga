import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { writeAudit } from "@/lib/audit";

export async function GET() {
  const session = await getSession();
  if (!session.userId || session.role !== "OWNER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const modal = await prisma.modalLog.findMany({
    orderBy: { tanggal: "desc" },
  });
  return NextResponse.json(modal);
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.userId || session.role !== "OWNER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { jumlah, tanggal, keterangan } = await request.json();
  if (!jumlah || !tanggal) {
    return NextResponse.json({ error: "Jumlah dan tanggal wajib diisi" }, { status: 400 });
  }

  const modal = await prisma.modalLog.create({
    data: {
      jumlah,
      tanggal: new Date(tanggal),
      keterangan: keterangan || null,
      createdBy: session.userId,
    },
  });
  await writeAudit({
    entityType: "MODAL",
    entityId: modal.id,
    action: "CREATE",
    newData: { jumlah, tanggal: modal.tanggal, keterangan: modal.keterangan },
    userId: session.userId,
  });
  return NextResponse.json(modal, { status: 201 });
}
