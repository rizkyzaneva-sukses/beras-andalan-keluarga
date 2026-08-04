# ---- Dependencies ----
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma/
RUN npm ci
RUN npx prisma generate

# ---- Build ----
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

# ---- Production ----
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN apk add --no-cache openssl

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Install production deps + prisma for db push
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npx prisma generate

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY prisma ./prisma/
COPY start.sh ./
RUN chmod +x start.sh

USER nextjs
EXPOSE 3000
ENV PORT=3000
CMD ["./start.sh"]
