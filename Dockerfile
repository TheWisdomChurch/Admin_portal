# syntax=docker/dockerfile:1

# ===== BASE =====
FROM node:20-alpine AS base
SHELL ["/bin/sh", "-lc"]
WORKDIR /app

# Needed by some deps
RUN apk add --no-cache libc6-compat

# ===== DEPS =====
FROM base AS deps
WORKDIR /app

ENV CI=true
ENV HUSKY=0

COPY package.json package-lock.json ./

# ✅ Key fix: prevent prepare/postinstall scripts (husky/git hooks/etc.)
RUN npm ci --ignore-scripts --no-audit --no-fund

# ===== BUILDER =====
FROM base AS builder
WORKDIR /app

ENV CI=true
ENV HUSKY=0
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build
RUN npm run build

# ===== PRODUCTION =====
FROM node:20-alpine AS production
SHELL ["/bin/sh", "-lc"]
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
EXPOSE 3000

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

USER nextjs
CMD ["node", "server.js"]
