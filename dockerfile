# syntax=docker/dockerfile:1

# ===== BASE STAGE =====
FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat
WORKDIR /app

# ===== DEPENDENCIES STAGE =====
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ===== DEVELOPMENT STAGE =====
FROM base AS development
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV WATCHPACK_POLLING=true
CMD ["npm", "run", "dev"]

# ===== BUILDER STAGE =====
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ===== PRODUCTION RUNNER STAGE =====
FROM node:22-alpine AS production
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
CMD ["node", "server.js"]
