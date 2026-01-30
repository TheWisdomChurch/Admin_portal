# syntax=docker/dockerfile:1

# ===== BASE =====
FROM node:20-alpine AS base
SHELL ["/bin/sh", "-lc"]
WORKDIR /app

# Tools commonly needed by npm deps
RUN apk add --no-cache libc6-compat git bash

# ===== DEPS =====
FROM base AS deps
WORKDIR /app
ENV HUSKY=0
ENV CI=true

COPY package.json package-lock.json ./

# If your lockfile is flaky in CI, use npm install instead of npm ci
RUN npm install --no-audit --no-fund

# ===== BUILDER =====
FROM base AS builder
WORKDIR /app
ENV HUSKY=0
ENV CI=true
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY . .

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

# Next standalone output (requires next.config.ts: output: 'standalone')
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

USER nextjs
CMD ["node", "server.js"]
