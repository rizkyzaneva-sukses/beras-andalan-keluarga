import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { ensureAuditBackfill } from "@/lib/audit";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session.userId || session.role !== "OWNER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  await ensureAuditBackfill();

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10) || 20));
  const entityType = searchParams.get("entity") || undefined;
  const action = searchParams.get("action") || undefined;

  const where = {
    ...(entityType ? { entityType } : {}),
    ...(action ? { action } : {}),
  };

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: { user: { select: { username: true } } },
    }),
    prisma.auditLog.count({ where }),
  ]);

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

  return NextResponse.json({ data: mapped, total, page, limit });
}
