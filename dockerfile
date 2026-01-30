# syntax=docker/dockerfile:1

FROM node:20-alpine AS base
SHELL ["/bin/sh", "-lc"]
WORKDIR /app

# ✅ add tools commonly required by npm lifecycle scripts
RUN apk add --no-cache libc6-compat git bash

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./

# sanity
RUN node -v && npm -v && git --version && bash --version

# Install deps (will now succeed if scripts needed git/bash)
RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV CI=true
RUN npm run build

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
