#!/bin/sh
set -e

# Use local prisma binary (v6.x), not npx (which may fetch Prisma 7.x)
export PATH="./node_modules/.bin:$PATH"

echo "Pushing Prisma schema to database..."
./node_modules/.bin/prisma db push --accept-data-loss

echo "Generating Prisma client..."
./node_modules/.bin/prisma generate

echo "Seeding database..."
npx tsx prisma/seed.ts || echo "Seed skipped or already done"

echo "Starting Next.js..."
exec node server.js
