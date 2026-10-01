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
# git for development checks/metadata during build; the PostgreSQL client for the
# database copy and migrations below. Both are source-independent, so this layer caches.
# The client is pinned to the database server's major version (17): copy-database.sh's
# pg_dump fallback refuses any other, and Alpine's unpinned postgresql-client has moved
# on to 18. Bump it together with the server.
RUN apk add --no-cache git postgresql17-client

# GitHub Packages auth — marked as BuildKit secret in Coolify (not baked into layers)
# Coolify auto-injects --mount=type=secret into every RUN instruction: https://coolify.io/docs/knowledge-base/environment-variables#docker-build-secrets

# 1. First, only copy files that determine the dependency tree (lockfile)
COPY pnpm-lock.yaml .npmrc pnpm-workspace.yaml ./

# GH_FONT_READ authenticates the @digitalgroundgame registry from a user-level .npmrc:
# pnpm won't expand it from the project .npmrc (#955). The file holds the placeholder,
# not the token, so it's safe in a layer; the token arrives as a build secret.
RUN printf '%s\n' '//npm.pkg.github.com/:_authToken=${GH_FONT_READ:-""}' > "$HOME/.npmrc"

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

# Database utility scripts — only rebuilt when these files change.
COPY --chmod=755 dockerfiles/scripts/database-uri.sh dockerfiles/scripts/modify-database-uri.sh dockerfiles/scripts/copy-database.sh /usr/local/bin/

# Copy remaining source code. Everything below reruns on every deploy, so steps whose
# output depends on source or on variable values (migrations, next build) belong here.
COPY . .

# --- BUILD CONFIGURATION ---
# Secrets (DATABASE_URI, PAYLOAD_SECRET, S3 creds) are injected via Coolify BuildKit secrets — not baked into layers
# Coolify auto-injects --mount=type=secret into every RUN instruction: https://coolify.io/docs/knowledge-base/environment-variables#docker-build-secrets
ARG NODE_ENV=production
ARG BUILD_ENV=production
ARG SERVER_URL
ARG NEXT_TELEMETRY_DISABLED=1

# --- STORAGE & S3 ---
ARG USE_LOCAL_STORAGE=false
ARG S3_REGION
ARG S3_BUCKET
ARG S3_ENDPOINT

# --- PUBLIC / CLIENT-SIDE ---
# TURNSTILE_SITE_KEY and GOOGLE_ANALYTICS_ID get no ARG: Coolify mounts every build
# variable into each RUN anyway, and a name ending in _KEY trips Docker's
# SecretsUsedInArgOrEnv check. SUPABASE_URL is only read at runtime.
ARG SENTRY_DSN

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
    SERVER_URL=${SERVER_URL} \
    SENTRY_DSN=${SENTRY_DSN}

# --- DATABASE PREPARATION & MIGRATION ---
# 1. Isolated Preview Logic (names and clones a database for each PR, then drops the
#    databases of closed PRs; best effort, never fails the build)
# 2. Migration Logic (runs on the final target DB)
# Each RUN gets DATABASE_URI afresh from its secret mount, so each one applies the
# preview database name from /tmp/database_name itself.
RUN /usr/local/bin/modify-database-uri.sh && \
    . /usr/local/bin/database-uri.sh && use_preview_database /tmp/database_name && \
    /usr/local/bin/copy-database.sh && \
    node dockerfiles/scripts/drop-closed-preview-databases.ts && \
    echo "--- PHASE: DATABASE MIGRATIONS ---" && \
    pnpm payload migrate && \
    echo "--- COMPLETED: DATABASE MIGRATIONS ---"

# --- NEXT.JS BUILD ---
# SOURCE_COMMIT arrives like the other Coolify variables, as a secret mounted into
# each RUN ("Include Source Commit in Build" must be on). .git is dockerignored, so
# it's what names the Sentry release baked into the browser bundle.
# The Turbopack cache is shared by every build on the server: `sharing=locked` keeps
# two builds from writing it at once, and build-next.sh rebuilds without it if it's
# been left corrupt.
# Pages prerendered here put SERVER_URL in their canonical and share links, so the
# build refuses to run without it rather than bake in http://localhost:8000.
RUN --mount=type=cache,id=nextjs,target=/app/.next/cache,sharing=locked \
    echo "--- PHASE: BUILDING NEXT.JS ---" && \
    { [ -n "$SERVER_URL" ] || { echo "ERROR: SERVER_URL is not set at build time (Coolify: enable Build Variable for it)"; exit 1; }; } && \
    . /usr/local/bin/database-uri.sh && use_preview_database /tmp/database_name && \
    SENTRY_RELEASE="${SOURCE_COMMIT}" sh dockerfiles/scripts/build-next.sh && \
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

# Carry the preview database's name (empty outside previews) to start.sh. Only the
# name: the credentials come from the runtime DATABASE_URI, never from the image.
COPY --from=builder --chown=nextjs:nodejs /tmp/database_name /app/database_name

# Prepare media directory and set permissions
RUN mkdir -p public/media \
    && chown nextjs:nodejs public/media \
    && chmod 755 public/media

# Startup script configuration
COPY --from=builder --chown=nextjs:nodejs --chmod=755 /app/dockerfiles/scripts/start.sh /app/dockerfiles/scripts/database-uri.sh ./

USER nextjs
EXPOSE 3000

# Healthy once Payload has started against the database: /api/users/me answers 200
# (user: null) without a login. A container whose start.sh exited, e.g. on a missing
# runtime DATABASE_URI, never turns healthy, so Coolify keeps the old one serving
# instead of swapping in a dead one. busybox wget fails on any non-2xx status.
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
    CMD wget -q -O /dev/null "http://127.0.0.1:${PORT:-3000}/api/users/me" || exit 1
ENTRYPOINT ["dumb-init", "--"]
CMD ["./start.sh"]