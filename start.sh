#!/bin/sh
set -e

echo "Pushing Prisma schema to database..."
npx prisma db push --accept-data-loss

echo "Generating Prisma client..."
npx prisma generate

echo "Seeding database..."
npx prisma db seed || echo "Seed skipped or already done"

echo "Starting Next.js..."
exec node server.js
