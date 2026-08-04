#!/bin/sh
set -e

# Use local prisma binary (v6.x)
export PATH="./node_modules/.bin:$PATH"

echo "Pushing Prisma schema to database..."
./node_modules/.bin/prisma db push --accept-data-loss --skip-generate

echo "Seeding database..."
npx tsx prisma/seed.ts || echo "Seed skipped or already done"

echo "Starting Next.js..."
exec node server.js
