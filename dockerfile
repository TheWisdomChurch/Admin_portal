# syntax=docker/dockerfile:1

# ===== BASE STAGE =====
FROM node:20-alpine AS base
SHELL ["/bin/sh", "-lc"]
WORKDIR /app

# Tools needed by npm but NOT git hooks
RUN apk add --no-cache libc6-compat git bash

# ===== DEPENDENCIES STAGE =====
FROM base AS deps
WORKDIR /app

# 🚫 Disable husky / git hooks / prepare scripts
ENV HUSKY=0
ENV CI=true

COPY package.json package-lock.json ./

# ✅ This WILL now succeed
RUN npm ci

# ===== BUILDER STAGE =====
FROM base AS builder
WORKDIR /app

ENV HUSKY=0
ENV CI=true
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build

# ===== PRODUCTION STAGE =====
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
