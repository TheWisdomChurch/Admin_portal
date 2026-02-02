# syntax=docker/dockerfile:1.4

# ===== BASE =====
FROM node:20-alpine AS base
SHELL ["/bin/sh", "-lc"]
WORKDIR /app

RUN apk add --no-cache libc6-compat

# ===== DEPS =====
FROM base AS deps
WORKDIR /app

ENV CI=true
ENV HUSKY=0

# ✅ Tools for git deps + native modules (sharp/swc/esbuild/etc.)
RUN apk add --no-cache \
  git \
  openssh-client \
  python3 \
  make \
  g++ \
  vips-dev

COPY package.json package-lock.json ./

# ✅ Ensure github host key is known (prevents "Host key verification failed")
RUN mkdir -p /root/.ssh && chmod 700 /root/.ssh \
 && ssh-keyscan github.com >> /root/.ssh/known_hosts

# ✅ If install fails, dump npm debug log into the GH Actions output
RUN --mount=type=ssh \
    node -v && npm -v \
 && npm ci --no-audit --no-fund \
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
