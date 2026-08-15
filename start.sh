#!/bin/sh
set -e

# Use local prisma binary (v6.x)
export PATH="./node_modules/.bin:$PATH"

echo "Pushing Prisma schema to database..."
./node_modules/.bin/prisma db push --accept-data-loss --skip-generate

echo "Seeding database..."
npx tsx prisma/seed.ts || echo "Seed skipped or already done"

# Docker sets HOSTNAME to the container id. Next standalone binds to that
# interface, so platform health checks to 127.0.0.1 fail.
export HOSTNAME=0.0.0.0
export PORT="${PORT:-3000}"

echo "Starting Next.js on ${HOSTNAME}:${PORT}..."
exec node server.js
