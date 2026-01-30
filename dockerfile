# syntax=docker/dockerfile:1

# ===== BASE STAGE =====
FROM node:20-alpine AS base
SHELL ["/bin/sh", "-lc"]
RUN apk add --no-cache libc6-compat
WORKDIR /app

# ===== DEPENDENCIES STAGE =====
FROM base AS deps
SHELL ["/bin/sh", "-lc"]
WORKDIR /app

# Copy only manifests for better caching
COPY package.json package-lock.json ./

# ✅ sanity check: prove node/npm exist in this stage
RUN which node && node -v && which npm && npm -v

# Install dependencies
RUN npm ci

# ===== BUILDER STAGE =====
FROM base AS builder
SHELL ["/bin/sh", "-lc"]
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV CI=true

RUN npm run build

# ===== PRODUCTION RUNNER STAGE =====
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
