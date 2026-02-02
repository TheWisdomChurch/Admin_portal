# syntax=docker/dockerfile:1

FROM node:20-alpine AS base
SHELL ["/bin/sh", "-lc"]
WORKDIR /app

RUN apk add --no-cache libc6-compat ca-certificates \
 && update-ca-certificates

# ===== DEPS =====
FROM base AS deps
WORKDIR /app

ENV CI=true
ENV HUSKY=0

RUN apk add --no-cache \
  git \
  python3 \
  make \
  g++ \
  vips-dev

COPY package.json package-lock.json ./

# prevents git hooks script from breaking docker builds
RUN npm pkg delete scripts.prepare || true

RUN npm ci --no-audit --no-fund

# ===== BUILDER =====
FROM base AS builder
WORKDIR /app

ENV CI=true
ENV HUSKY=0
ENV NEXT_TELEMETRY_DISABLED=1

# ✅ accept both names (your code checks either)
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_BACKEND_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_PUBLIC_BACKEND_URL=${NEXT_PUBLIC_BACKEND_URL}

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build --loglevel verbose

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
