#!/bin/sh
set -e

# Use local prisma binary (v6.x)
export PATH="./node_modules/.bin:$PATH"

echo "Pushing Prisma schema to database..."
./node_modules/.bin/prisma db push --accept-data-loss --skip-generate

# tsx is a devDependency and is not present in the production image.
# `npx tsx ...` will try to download it and can hang forever, leaving the
# service unhealthy. Only seed when the local binary exists.
echo "Seeding database..."
if [ -x "./node_modules/.bin/tsx" ]; then
  ./node_modules/.bin/tsx prisma/seed.ts || echo "Seed skipped or already done"
else
  echo "tsx not available in production image; skipping seed"
fi

# Docker sets HOSTNAME to the container id. Next standalone binds to that
# interface, so platform health checks to 127.0.0.1 fail.
export HOSTNAME=0.0.0.0
export PORT="${PORT:-3000}"

echo "Starting Next.js on ${HOSTNAME}:${PORT}..."
exec node server.js
