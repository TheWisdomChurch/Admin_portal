# syntax=docker/dockerfile:1

# ===== BASE =====
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

# ✅ Native deps for sharp/swc/esbuild on Alpine
RUN apk add --no-cache \
  git \
  python3 \
  make \
  g++ \
  vips-dev

COPY package.json package-lock.json ./

# ✅ Fix: remove prepare script (your repo runs `git config core.hooksPath ...` and fails in Docker)
RUN npm pkg delete scripts.prepare || true

RUN npm ci --no-audit --no-fund

# ===== DEVELOPMENT =====
FROM base AS development
WORKDIR /app

ENV NODE_ENV=development
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY . .

EXPOSE 3000
CMD ["npm", "run", "dev"]

# ===== BUILDER =====
FROM base AS builder
WORKDIR /app

ENV CI=true
ENV HUSKY=0
ENV NEXT_TELEMETRY_DISABLED=1

# ✅ Accept both names your code checks + portal url
ARG NEXT_PUBLIC_BACKEND_URL
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_API_PROXY
ARG APP_ADMIN_PORTAL_URL

# Public values are intentionally non-secret build configuration. Browser API
# traffic uses the same-origin BFF by default; API_INTERNAL_URL is runtime-only.
ENV NEXT_PUBLIC_BACKEND_URL=${NEXT_PUBLIC_BACKEND_URL:-https://api.wisdomchurchhq.org}
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL:-https://api.wisdomchurchhq.org}
ENV NEXT_PUBLIC_API_PROXY=${NEXT_PUBLIC_API_PROXY:-true}
ENV APP_ADMIN_PORTAL_URL=${APP_ADMIN_PORTAL_URL:-https://admin-portalwisdomchurch.org}

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
ENV HOSTNAME=0.0.0.0
EXPOSE 3000

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

# Next standalone output
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

USER nextjs
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/login').then(r=>{if(r.status>=500)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
