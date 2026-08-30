import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session.userId || session.role !== "OWNER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") || "";

  const items = await prisma.pembelanjaan.findMany({
    where: search ? { namaBarang: { contains: search, mode: "insensitive" } } : {},
    select: { namaBarang: true },
    distinct: ["namaBarang"],
    orderBy: { namaBarang: "asc" },
    take: 20,
  });

  return NextResponse.json({ data: items.map((i) => i.namaBarang) });
}
