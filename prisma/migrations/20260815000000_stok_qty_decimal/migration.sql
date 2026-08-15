-- Stok/qty pecahan untuk telur timbangan (0,7 kg, 1/4, 1/3, 1/2)
ALTER TABLE "produk" ALTER COLUMN "stok" SET DATA TYPE DECIMAL(12,3) USING "stok"::DECIMAL(12,3);
ALTER TABLE "penjualan" ALTER COLUMN "qty" SET DATA TYPE DECIMAL(12,3) USING "qty"::DECIMAL(12,3);
ALTER TABLE "pembelanjaan" ALTER COLUMN "jumlah" SET DATA TYPE DECIMAL(12,3) USING "jumlah"::DECIMAL(12,3);
