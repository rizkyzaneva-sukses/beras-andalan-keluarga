-- CreateTable
CREATE TABLE "stok_adjustment" (
    "id" TEXT NOT NULL,
    "produk_id" TEXT NOT NULL,
    "stok_sistem" DECIMAL(12,3) NOT NULL,
    "stok_fisik" DECIMAL(12,3) NOT NULL,
    "selisih" DECIMAL(12,3) NOT NULL,
    "alasan" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stok_adjustment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "stok_adjustment_produk_id_idx" ON "stok_adjustment"("produk_id");

-- CreateIndex
CREATE INDEX "stok_adjustment_created_at_idx" ON "stok_adjustment"("created_at");

-- AddForeignKey
ALTER TABLE "stok_adjustment" ADD CONSTRAINT "stok_adjustment_produk_id_fkey" FOREIGN KEY ("produk_id") REFERENCES "produk"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stok_adjustment" ADD CONSTRAINT "stok_adjustment_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
