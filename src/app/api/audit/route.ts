import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session.userId || session.role !== "OWNER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get("limit") || "50");

  const logs = await prisma.auditLog.findMany({
    take: limit,
    orderBy: { createdAt: "desc" },
    include: { user: { select: { username: true } } },
  });

  const mapped = logs.map((l) => ({
    id: l.id,
    entityType: l.entityType,
    entityId: l.entityId,
    action: l.action,
    oldData: l.oldData ? JSON.parse(l.oldData) : null,
    newData: l.newData ? JSON.parse(l.newData) : null,
    username: l.user.username,
    createdAt: l.createdAt,
  }));

  return NextResponse.json({ data: mapped });
}
