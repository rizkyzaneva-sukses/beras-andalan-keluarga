import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("admin123", 10);

  const owner = await prisma.user.upsert({
    where: { username: "owner" },
    update: {},
    create: {
      username: "owner",
      passwordHash,
      role: "OWNER",
    },
  });

  await prisma.user.upsert({
    where: { username: "kasir" },
    update: {},
    create: {
      username: "kasir",
      passwordHash: await bcrypt.hash("kasir123", 10),
      role: "KASIR",
    },
  });

  await prisma.produk.upsert({
    where: { id: "seed-produk-1" },
    update: {},
    create: {
      id: "seed-produk-1",
      nama: "Beras Pandan Wangi",
      satuan: "kg",
      hargaBeli: 12000,
      hargaJual: 15000,
    },
  });

  await prisma.produk.upsert({
    where: { id: "seed-produk-2" },
    update: {},
    create: {
      id: "seed-produk-2",
      nama: "Beras IR 64",
      satuan: "kg",
      hargaBeli: 10000,
      hargaJual: 13000,
    },
  });

  await prisma.modalLog.upsert({
    where: { id: "seed-modal-1" },
    update: {},
    create: {
      id: "seed-modal-1",
      jumlah: 5000000,
      tanggal: new Date("2026-01-01"),
      keterangan: "Modal awal usaha",
      createdBy: owner.id,
    },
  });

  console.log("Seed completed");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
