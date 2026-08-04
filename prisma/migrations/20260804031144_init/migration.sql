-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "produk" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nama" TEXT NOT NULL,
    "satuan" TEXT NOT NULL,
    "harga_beli" INTEGER NOT NULL,
    "harga_jual" INTEGER NOT NULL,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "modal_log" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jumlah" INTEGER NOT NULL,
    "tanggal" DATETIME NOT NULL,
    "keterangan" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "modal_log_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "user" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "pembelanjaan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tanggal" DATETIME NOT NULL,
    "kategori" TEXT NOT NULL,
    "nama_barang" TEXT NOT NULL,
    "jumlah" INTEGER NOT NULL,
    "harga" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "created_by" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pembelanjaan_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "user" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "penjualan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tanggal" DATETIME NOT NULL,
    "produk_id" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "harga_jual" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "metode_bayar" TEXT NOT NULL,
    "harga_disesuaikan" BOOLEAN NOT NULL DEFAULT false,
    "created_by" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "penjualan_produk_id_fkey" FOREIGN KEY ("produk_id") REFERENCES "produk" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "penjualan_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "user" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "user_username_key" ON "user"("username");
