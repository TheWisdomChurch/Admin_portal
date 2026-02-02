# syntax=docker/dockerfile:1

FROM node:20-alpine AS base
SHELL ["/bin/sh", "-lc"]
WORKDIR /app

# Base OS deps
RUN apk add --no-cache libc6-compat ca-certificates \
 && update-ca-certificates

# ===== DEPS =====
FROM base AS deps
WORKDIR /app

ENV CI=true
ENV HUSKY=0

# Build tools for native deps (sharp/swc/esbuild etc.)
RUN apk add --no-cache \
  git \
  python3 \
  make \
  g++ \
  vips-dev

COPY package.json package-lock.json ./

# (Optional) pin npm to reduce CI weirdness
RUN npm -v && npm i -g npm@10.8.3 && npm -v

# Extra diagnostics + install
RUN node -v \
 && echo "---- lockfileVersion ----" \
 && node -e "console.log(require('./package-lock.json').lockfileVersion)" \
 && echo "---- npm config ----" \
 && npm config list \
 && echo "---- npm ci ----" \
 && npm ci --no-audit --no-fund --loglevel verbose \
 || (echo "---- npm debug log ----" \
     && ls -la /root/.npm/_logs || true \
     && cat /root/.npm/_logs/*-debug-0.log || true \
     && exit 1)

# ===== BUILDER =====
FROM base AS builder
WORKDIR /app

ENV CI=true
ENV HUSKY=0
ENV NEXT_TELEMETRY_DISABLED=1

ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

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
