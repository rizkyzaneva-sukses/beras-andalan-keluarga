-- AlterEnum
ALTER TYPE "MetodeBayar" ADD VALUE 'HUTANG';

-- AlterTable
ALTER TABLE "pembelanjaan" ADD COLUMN "produk_id" TEXT;

-- AlterTable
ALTER TABLE "penjualan" ADD COLUMN "nama_pelanggan" TEXT;
ALTER TABLE "penjualan" ADD COLUMN "piutang_id" TEXT;

-- CreateTable
CREATE TABLE "piutang" (
    "id" TEXT NOT NULL,
    "nama_pelanggan" TEXT NOT NULL,
    "tanggal" TIMESTAMP(3) NOT NULL,
    "total" INTEGER NOT NULL,
    "sudah_dibayar" INTEGER NOT NULL DEFAULT 0,
    "keterangan" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "piutang_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pembayaran_piutang" (
    "id" TEXT NOT NULL,
    "piutang_id" TEXT NOT NULL,
    "jumlah" INTEGER NOT NULL,
    "tanggal" TIMESTAMP(3) NOT NULL,
    "metode_bayar" "MetodeBayar" NOT NULL,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pembayaran_piutang_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "pembelanjaan" ADD CONSTRAINT "pembelanjaan_produk_id_fkey" FOREIGN KEY ("produk_id") REFERENCES "produk"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "penjualan" ADD CONSTRAINT "penjualan_piutang_id_fkey" FOREIGN KEY ("piutang_id") REFERENCES "piutang"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "piutang" ADD CONSTRAINT "piutang_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pembayaran_piutang" ADD CONSTRAINT "pembayaran_piutang_piutang_id_fkey" FOREIGN KEY ("piutang_id") REFERENCES "piutang"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pembayaran_piutang" ADD CONSTRAINT "pembayaran_piutang_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
