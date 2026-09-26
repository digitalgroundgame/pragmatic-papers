# Dockerfile for Pragmatic Papers (Next.js + Payload CMS)
# Based on official Next.js Docker deployment guides
ARG NODE_VERSION=24.15.0

# ============================================
# Base stage - setup pnpm and environment
# ============================================
FROM node:${NODE_VERSION}-alpine AS base
# Install dependencies for native modules (libc6-compat is required for many node native modules on Alpine)
RUN apk add --no-cache libc6-compat

# Setup pnpm environment
ENV PNPM_HOME="/pnpm" \
    PATH="/pnpm:$PATH"

# Enable corepack and install the specific pnpm version from package.json
RUN --mount=type=bind,source=package.json,target=package.json \
    corepack enable \
    && corepack prepare "$(node -p "require('./package.json').packageManager")" --activate

WORKDIR /app

# ============================================
# Builder stage - install deps and build
# ============================================
FROM base AS builder
# git for development checks/metadata during build; postgresql-client for the
# database copy and migrations below. Both are source-independent, so this layer caches.
RUN apk add --no-cache git postgresql-client

# GitHub Packages auth — marked as BuildKit secret in Coolify (not baked into layers)
# Coolify auto-injects --mount=type=secret into every RUN instruction: https://coolify.io/docs/knowledge-base/environment-variables#docker-build-secrets

# 1. First, only copy files that determine the dependency tree (lockfile)
COPY pnpm-lock.yaml .npmrc pnpm-workspace.yaml ./

# 2. Fetch dependencies into the pnpm store using a cache mount.
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    echo "--- PHASE: FETCHING DEPENDENCIES ---" \
    && pnpm fetch --store-dir /pnpm/store \
    && echo "--- COMPLETED: FETCHING DEPENDENCIES ---"

# 3. Copy package.json and necessary post-install scripts.
COPY package.json ./
COPY scripts/install-fonts.ts scripts/ansi.mjs scripts/Inter-Bold.woff2 ./scripts/

# A deploy must ship the real FKScreamer. Without this, an expired or unscoped
# GH_FONT_READ degrades to the bundled Inter fallback and the build still succeeds —
# shipping the wrong typeface. install-fonts.ts exits non-zero instead. Builder stage
# only, so local installs and fork CI keep the lenient fallback.
ENV FONTS_REQUIRED=true

# 4. Install dependencies from the store (offline)
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    echo "--- PHASE: INSTALLING DEPENDENCIES (OFFLINE) ---" \
    && HUSKY=0 CI=true pnpm install --frozen-lockfile --offline --store-dir /pnpm/store \
    && echo "--- COMPLETED: INSTALLING DEPENDENCIES ---"

# Database utility scripts — only rebuilt when these two files change.
COPY --chmod=755 dockerfiles/scripts/modify-database-uri.sh dockerfiles/scripts/copy-database.sh /usr/local/bin/

# Copy remaining source code. Everything below reruns on every deploy, so steps whose
# output depends on source or on variable values (migrations, next build) belong here.
COPY . .

# --- BUILD CONFIGURATION ---
# Secrets (DATABASE_URI, PAYLOAD_SECRET, S3 creds) are injected via Coolify BuildKit secrets — not baked into layers
# Coolify auto-injects --mount=type=secret into every RUN instruction: https://coolify.io/docs/knowledge-base/environment-variables#docker-build-secrets
ARG NODE_ENV=production
ARG BUILD_ENV=production
ARG NEXT_PUBLIC_SERVER_URL
ARG NEXT_TELEMETRY_DISABLED=1

# --- STORAGE & S3 ---
ARG USE_LOCAL_STORAGE=false
ARG S3_REGION
ARG S3_BUCKET
ARG S3_ENDPOINT

# --- PUBLIC / CLIENT-SIDE ---
ARG NEXT_PUBLIC_GOOGLE_ANALYTICS_ID
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SENTRY_DSN
ARG NEXT_PUBLIC_SENTRY_ENVIRONMENT
ARG NEXT_PUBLIC_TURNSTILE_SITE_KEY

# --- COOLIFY & DEPLOYMENT ---
ARG COOLIFY_FQDN=
ARG COPY_SOURCE_DATABASE=false
ARG FORCE_DATABASE_COPY=false

# --- ENVIRONMENT MAPPING ---
# Non-sensitive config only. Secrets (DATABASE_URI, PAYLOAD_SECRET, S3 creds) are
# injected per-RUN-step via Coolify BuildKit secrets — never baked into layers.
# In that mode Coolify passes no --build-arg, so these hold only the ARG defaults; each
# RUN sees the real values from its secret mounts, which override them.
ENV NODE_ENV=${NODE_ENV} \
    BUILD_ENV=${BUILD_ENV} \
    NEXT_TELEMETRY_DISABLED=${NEXT_TELEMETRY_DISABLED} \
    DATABASE_ADAPTER=postgres \
    USE_LOCAL_STORAGE=${USE_LOCAL_STORAGE} \
    S3_REGION=${S3_REGION} \
    S3_BUCKET=${S3_BUCKET} \
    S3_ENDPOINT=${S3_ENDPOINT} \
    NEXT_PUBLIC_GOOGLE_ANALYTICS_ID=${NEXT_PUBLIC_GOOGLE_ANALYTICS_ID} \
    NEXT_PUBLIC_SERVER_URL=${NEXT_PUBLIC_SERVER_URL} \
    NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL} \
    NEXT_PUBLIC_SENTRY_DSN=${NEXT_PUBLIC_SENTRY_DSN} \
    NEXT_PUBLIC_SENTRY_ENVIRONMENT=${NEXT_PUBLIC_SENTRY_ENVIRONMENT} \
    NEXT_PUBLIC_TURNSTILE_SITE_KEY=${NEXT_PUBLIC_TURNSTILE_SITE_KEY}

# --- DATABASE PREPARATION & MIGRATION ---
# 1. Isolated Preview Logic (clones DB for PRs)
# 2. Migration Logic (runs on the final target DB)
RUN /usr/local/bin/modify-database-uri.sh && \
    if [ -f /tmp/database_uri.env ]; then . /tmp/database_uri.env; fi && \
    /usr/local/bin/copy-database.sh && \
    echo "--- PHASE: DATABASE MIGRATIONS ---" && \
    pnpm payload migrate && \
    echo "--- COMPLETED: DATABASE MIGRATIONS ---"

# --- NEXT.JS BUILD ---
# SOURCE_COMMIT arrives like the other Coolify variables, as a secret mounted into
# each RUN ("Include Source Commit in Build" must be on). .git is dockerignored, so
# it's what names the Sentry release baked into the browser bundle.
RUN --mount=type=cache,id=nextjs,target=/app/.next/cache \
    echo "--- PHASE: BUILDING NEXT.JS ---" && \
    if [ -f /tmp/database_uri.env ]; then . /tmp/database_uri.env; fi && \
    SENTRY_RELEASE="${SOURCE_COMMIT}" pnpm build && \
    echo "--- COMPLETED: BUILDING NEXT.JS ---"

# ============================================
# Runner stage - minimal production runtime
# ============================================
FROM node:${NODE_VERSION}-alpine AS runner
WORKDIR /app

# Production environment
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME="0.0.0.0"

# Install runtime dependencies and create non-root user
RUN apk add --no-cache dumb-init libc6-compat \
    && addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

# Copy the standalone Next.js build
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# PERSISTENCE FIX: Carry the isolated DATABASE_URI from builder to runner
COPY --from=builder --chown=nextjs:nodejs /tmp/database_uri.env /app/database_uri.env

# Prepare media directory and set permissions
RUN mkdir -p public/media \
    && chown nextjs:nodejs public/media \
    && chmod 755 public/media

# Startup script configuration
COPY --from=builder --chown=nextjs:nodejs --chmod=755 /app/dockerfiles/scripts/start.sh ./start.sh

USER nextjs
EXPOSE 3000
ENTRYPOINT ["dumb-init", "--"]
CMD ["./start.sh"]