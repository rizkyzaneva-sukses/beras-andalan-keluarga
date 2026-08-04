#!/bin/sh
set -e

# Use local prisma binary, not npx (which may fetch Prisma 7.x)
export PATH="/app/node_modules/.bin:$PATH"

echo "Pushing Prisma schema to database..."
prisma db push --accept-data-loss

echo "Generating Prisma client..."
prisma generate

echo "Seeding database..."
npx tsx prisma/seed.ts || echo "Seed skipped or already done"

echo "Starting Next.js..."
exec node server.js
