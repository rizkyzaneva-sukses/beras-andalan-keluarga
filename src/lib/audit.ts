import { prisma } from "@/lib/prisma";

export type AuditAction = "CREATE" | "UPDATE" | "DELETE";
export type AuditEntity = "PENJUALAN" | "PEMBELANJAAN" | "MODAL" | "PRODUK" | "USER" | "UTANG";

type WriteAuditInput = {
  entityType: AuditEntity;
  entityId: string;
  action: AuditAction;
  oldData?: Record<string, unknown> | null;
  newData?: Record<string, unknown> | null;
  userId: string;
  createdAt?: Date;
};

export async function writeAudit(input: WriteAuditInput) {
  await prisma.auditLog.create({
    data: {
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      oldData: input.oldData ? JSON.stringify(input.oldData) : null,
      newData: input.newData ? JSON.stringify(input.newData) : null,
      userId: input.userId,
      ...(input.createdAt ? { createdAt: input.createdAt } : {}),
    },
  });
}

export function diffFields(
  oldRecord: Record<string, unknown>,
  newRecord: Record<string, unknown>,
  fields: string[],
) {
  const oldData: Record<string, unknown> = {};
  const newData: Record<string, unknown> = {};
  let hasChanges = false;
  for (const field of fields) {
    const oldVal = oldRecord[field];
    const newVal = newRecord[field];
    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      oldData[field] = oldVal;
      newData[field] = newVal;
      hasChanges = true;
    }
  }
  return { oldData, newData, hasChanges };
}

let backfillInFlight: Promise<void> | null = null;

export async function ensureAuditBackfill() {
  if (!backfillInFlight) {
    backfillInFlight = backfillMissingAudit().finally(() => {
      backfillInFlight = null;
    });
  }
  await backfillInFlight;
}

async function backfillMissingAudit() {
  const owner = await prisma.user.findFirst({
    where: { role: "OWNER" },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (!owner) return;

  const [createCount, penjualanCount, pembelanjaanCount, modalCount, produkCount, userCount, utangCount] = await Promise.all([
    prisma.auditLog.count({ where: { action: "CREATE" } }),
    prisma.penjualan.count(),
    prisma.pembelanjaan.count(),
    prisma.modalLog.count(),
    prisma.produk.count(),
    prisma.user.count(),
    prisma.pembayaranUtang.count(),
  ]);

  const expected = penjualanCount + pembelanjaanCount + modalCount + produkCount + userCount + utangCount;
  if (createCount >= expected) return;

  const existingCreates = await prisma.auditLog.findMany({
    where: { action: "CREATE" },
    select: { entityId: true },
  });
  const have = new Set(existingCreates.map((row) => row.entityId));
  const users = await prisma.user.findMany({ select: { id: true } });
  const validUserIds = new Set(users.map((u) => u.id));

  const actor = (userId: string) => (validUserIds.has(userId) ? userId : owner.id);

  const [penjualan, pembelanjaan, modal, produk, allUsers, pembayaran] = await Promise.all([
    prisma.penjualan.findMany({ include: { produk: { select: { nama: true } } } }),
    prisma.pembelanjaan.findMany(),
    prisma.modalLog.findMany(),
    prisma.produk.findMany(),
    prisma.user.findMany({ select: { id: true, username: true, role: true, isActive: true, createdAt: true } }),
    prisma.pembayaranUtang.findMany({ include: { pembelanjaan: { select: { namaBarang: true } } } }),
  ]);

  const rows: {
    entityType: AuditEntity;
    entityId: string;
    action: "CREATE";
    oldData: null;
    newData: string;
    userId: string;
    createdAt: Date;
  }[] = [];

  for (const p of penjualan) {
    if (have.has(p.id)) continue;
    rows.push({
      entityType: "PENJUALAN",
      entityId: p.id,
      action: "CREATE",
      oldData: null,
      newData: JSON.stringify({
        produkNama: p.produk.nama,
        qty: p.qty,
        hargaJual: p.hargaJual,
        total: p.total,
        metodeBayar: p.metodeBayar,
        tanggal: p.tanggal,
      }),
      userId: actor(p.createdBy),
      createdAt: p.createdAt,
    });
  }

  for (const p of pembelanjaan) {
    if (have.has(p.id)) continue;
    rows.push({
      entityType: "PEMBELANJAAN",
      entityId: p.id,
      action: "CREATE",
      oldData: null,
      newData: JSON.stringify({
        namaBarang: p.namaBarang,
        kategori: p.kategori,
        jumlah: p.jumlah,
        harga: p.harga,
        total: p.total,
        statusBayar: p.statusBayar,
        tanggal: p.tanggal,
      }),
      userId: actor(p.createdBy),
      createdAt: p.createdAt,
    });
  }

  for (const m of modal) {
    if (have.has(m.id)) continue;
    rows.push({
      entityType: "MODAL",
      entityId: m.id,
      action: "CREATE",
      oldData: null,
      newData: JSON.stringify({
        jumlah: m.jumlah,
        tanggal: m.tanggal,
        keterangan: m.keterangan,
      }),
      userId: actor(m.createdBy),
      createdAt: m.createdAt,
    });
  }

  for (const p of produk) {
    if (have.has(p.id)) continue;
    rows.push({
      entityType: "PRODUK",
      entityId: p.id,
      action: "CREATE",
      oldData: null,
      newData: JSON.stringify({
        nama: p.nama,
        satuan: p.satuan,
        hargaBeli: p.hargaBeli,
        hargaJual: p.hargaJual,
      }),
      userId: owner.id,
      createdAt: p.createdAt,
    });
  }

  for (const u of allUsers) {
    if (have.has(u.id)) continue;
    rows.push({
      entityType: "USER",
      entityId: u.id,
      action: "CREATE",
      oldData: null,
      newData: JSON.stringify({
        username: u.username,
        role: u.role,
        isActive: u.isActive,
      }),
      userId: owner.id,
      createdAt: u.createdAt,
    });
  }

  for (const b of pembayaran) {
    if (have.has(b.id)) continue;
    rows.push({
      entityType: "UTANG",
      entityId: b.id,
      action: "CREATE",
      oldData: null,
      newData: JSON.stringify({
        namaBarang: b.pembelanjaan.namaBarang,
        jumlah: b.jumlah,
        tanggal: b.tanggal,
      }),
      userId: actor(b.createdBy),
      createdAt: b.createdAt,
    });
  }

  if (rows.length === 0) return;
  await prisma.auditLog.createMany({ data: rows });
}
