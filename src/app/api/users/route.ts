import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { writeAudit } from "@/lib/audit";
import bcrypt from "bcryptjs";

export async function GET() {
  const session = await getSession();
  if (!session.userId || session.role !== "OWNER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  const users = await prisma.user.findMany({
    select: { id: true, username: true, role: true, isActive: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ data: users });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.userId || session.role !== "OWNER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  const { username, password, role } = await request.json();
  if (!username || !password || !role) {
    return NextResponse.json({ error: "Username, password, dan role wajib diisi" }, { status: 400 });
  }
  const exists = await prisma.user.findUnique({ where: { username } });
  if (exists) return NextResponse.json({ error: "Username sudah digunakan" }, { status: 400 });
  const user = await prisma.user.create({
    data: { username, passwordHash: await bcrypt.hash(password, 10), role },
    select: { id: true, username: true, role: true, isActive: true, createdAt: true },
  });
  await writeAudit({
    entityType: "USER",
    entityId: user.id,
    action: "CREATE",
    newData: { username: user.username, role: user.role, isActive: user.isActive },
    userId: session.userId,
  });
  return NextResponse.json({ data: user }, { status: 201 });
}
