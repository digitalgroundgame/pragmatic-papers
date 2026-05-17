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
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

# Enable corepack and install the specific pnpm version from package.json
# We use a bind mount to read package.json without adding it to the image layer
RUN --mount=type=bind,source=package.json,target=package.json \
    corepack enable && \
    corepack prepare "$(node -p "require('./package.json').packageManager")" --activate

WORKDIR /app

# ============================================
# Builder stage - install deps and build
# ============================================
FROM base AS builder
# Install git for development checks/metadata during build if needed
RUN apk add --no-cache git

# GitHub Packages auth (set GH_FONT_READ as build arg in Coolify for staging/prod)
ARG GH_FONT_READ
ENV GH_FONT_READ=${GH_FONT_READ}

# 1. First, only copy files that determine the dependency tree (lockfile)
COPY pnpm-lock.yaml .npmrc ./

# 2. Fetch dependencies into the pnpm store using a cache mount.
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    echo "--- PHASE: FETCHING DEPENDENCIES ---" && \
    pnpm fetch --store-dir /pnpm/store && \
    echo "--- COMPLETED: FETCHING DEPENDENCIES ---"

# 3. Copy package.json and necessary post-install scripts.
COPY package.json ./
COPY scripts/install-fonts.mjs scripts/ansi.mjs ./scripts/

# 4. Install dependencies from the store (offline)
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    echo "--- PHASE: INSTALLING DEPENDENCIES (OFFLINE) ---" && \
    HUSKY=0 CI=true pnpm install --frozen-lockfile --offline --store-dir /pnpm/store && \
    echo "--- COMPLETED: INSTALLING DEPENDENCIES ---"

# Copy remaining source code (cache miss here won't re-trigger install)
COPY . .

# Copy database utility scripts
COPY dockerfiles/scripts/modify-database-uri.sh /usr/local/bin/modify-database-uri.sh
COPY dockerfiles/scripts/copy-database.sh /usr/local/bin/copy-database.sh
RUN chmod +x /usr/local/bin/modify-database-uri.sh /usr/local/bin/copy-database.sh

# Build Arguments
ARG NODE_ENV=production
ARG BUILD_ENV=production
ARG DATABASE_URI
ARG PAYLOAD_SECRET
ARG USE_LOCAL_STORAGE=false
ARG S3_REGION
ARG S3_BUCKET
ARG S3_ACCESS_KEY_ID
ARG S3_SECRET_ACCESS_KEY
ARG S3_ENDPOINT
ARG NEXT_PUBLIC_GOOGLE_ANALYTICS_ID
ARG NEXT_PUBLIC_SERVER_URL
ARG NEXT_PUBLIC_SUPABASE_URL

# Coolify-specific configuration
# COOLIFY_FQDN is automatically set by Coolify (e.g., "pr-330.pragmaticpapers.com")
# When BUILD_ENV=preview, we extract the prefix and append it to database names
# This creates unique databases for each preview deployment (e.g., "pragmatic_papers_pr_330")
ARG COOLIFY_FQDN=
# Database copy configuration for preview deployments
ARG COPY_SOURCE_DATABASE=false
ARG SOURCE_DATABASE_URI
ARG FORCE_DATABASE_COPY=false

# Environment Variables
ENV NODE_ENV=${NODE_ENV}
ENV BUILD_ENV=${BUILD_ENV}
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_ADAPTER=postgres
ENV DATABASE_URI=${DATABASE_URI}
ENV PAYLOAD_SECRET=${PAYLOAD_SECRET}
ENV USE_LOCAL_STORAGE=${USE_LOCAL_STORAGE}
ENV S3_REGION=${S3_REGION}
ENV S3_BUCKET=${S3_BUCKET}
ENV S3_ACCESS_KEY_ID=${S3_ACCESS_KEY_ID}
ENV S3_SECRET_ACCESS_KEY=${S3_SECRET_ACCESS_KEY}
ENV S3_ENDPOINT=${S3_ENDPOINT}
ENV NEXT_PUBLIC_GOOGLE_ANALYTICS_ID=${NEXT_PUBLIC_GOOGLE_ANALYTICS_ID}
ENV NEXT_PUBLIC_SERVER_URL=${NEXT_PUBLIC_SERVER_URL}
ENV NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}

# Coolify-specific environment variables
ENV COOLIFY_FQDN=${COOLIFY_FQDN}
# Database copy environment variables
ENV COPY_SOURCE_DATABASE=${COPY_SOURCE_DATABASE}
ENV SOURCE_DATABASE_URI=${SOURCE_DATABASE_URI}
ENV FORCE_DATABASE_COPY=${FORCE_DATABASE_COPY}

# Install PostgreSQL client only for preview deployments (database copy operations)
RUN if [ "$BUILD_ENV" = "preview" ]; then \
        apk add --no-cache postgresql-client; \
    fi

# --- PREVIEW ISOLATION LOGIC ---
# 1. If BUILD_ENV=preview, modify-database-uri.sh generates a unique DB name based on PR number.
# 2. We store this NEW_DATABASE_URI in /tmp/build.env to persist it.
# 3. copy-database.sh clones the staging DB into this new isolated PR database.
RUN /usr/local/bin/modify-database-uri.sh && \
    if [ -f /tmp/database_uri.env ]; then \
        . /tmp/database_uri.env && \
        echo "export DATABASE_URI='$DATABASE_URI'" > /tmp/build.env && \
        /usr/local/bin/copy-database.sh; \
    else \
        echo "export DATABASE_URI='$DATABASE_URI'" > /tmp/build.env && \
        /usr/local/bin/copy-database.sh; \
    fi

# Build application
# Source the potentially modified DATABASE_URI before building
RUN --mount=type=cache,id=nextjs,target=/app/.next/cache \
    echo "--- PHASE: BUILDING NEXT.JS ---" && \
    . /tmp/build.env && \
    pnpm build && \
    echo "--- COMPLETED: BUILDING NEXT.JS ---"

# ============================================
# Production dependencies stage (hoisted)
# ============================================
FROM base AS prod-deps
# GitHub Packages auth (needed if optional fonts are to be fetched)
ARG GH_FONT_READ
ENV GH_FONT_READ=${GH_FONT_READ}

COPY pnpm-lock.yaml .npmrc package.json ./
# We use hoisted node-linker to ensure a standard node_modules structure without symlinks.
# This makes the node_modules directory portable and ensures CLI tools like payload are available.
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    echo "--- PHASE: INSTALLING PRODUCTION DEPENDENCIES (HOISTED) ---" && \
    pnpm install --prod --frozen-lockfile --config.node-linker=hoisted --store-dir /pnpm/store && \
    echo "--- COMPLETED: INSTALLING PRODUCTION DEPENDENCIES ---"

# ============================================
# Runner stage - minimal production runtime
# ============================================
FROM node:${NODE_VERSION}-alpine AS runner
WORKDIR /app
# dumb-init ensures proper signal handling (SIGTERM) for Node.js
# libc6-compat is required for native modules like sharp on Alpine
RUN apk add --no-cache dumb-init libc6-compat

# Set production environment
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Enable Next.js logging
ENV NEXT_PRIVATE_DEBUG_CACHE=1

# Force all logs to stdout/stderr for Docker
ENV FORCE_COLOR=0

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# 1. Copy the standalone Next.js build first
# The standalone build includes a minimal server.js and a PRUNED node_modules.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./

# 2. OVERLAY the full production node_modules
# This "un-prunes" the node_modules directory, ensuring all CLI tools (like payload/bin.js)
# and runtime dependencies are available for migrations.
COPY --from=prod-deps --chown=nextjs:nodejs /app/node_modules ./node_modules

# 3. Copy static assets and public folder
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# 4. Migration Support at Runtime
# We install tsx and copy the source code to the runner stage.
# This allows us to run 'payload migrate' in the startup script using tsx.
RUN npm install -g tsx
COPY --from=builder --chown=nextjs:nodejs /app/src ./src

# PERSISTENCE FIX: Copy the unique DATABASE_URI from the Builder stage to the Runner stage
COPY --from=builder --chown=nextjs:nodejs /tmp/build.env ./build.env

# Prepare media directory for local storage deployments
# We also ensure all app files are owned by the nextjs user
RUN mkdir -p public/media && \
  chown -R nextjs:nodejs . && \
  chmod -R 755 public/media

# STARTUP SCRIPT: Run migrations and start the server
COPY --from=builder --chown=nextjs:nodejs /app/dockerfiles/scripts/start.sh ./start.sh
RUN chmod +x ./start.sh

# Switch to non-root user
USER nextjs
# Expose port for Next.js application
EXPOSE 3000
# Use dumb-init to handle signals properly (SIGTERM, etc.)
ENTRYPOINT ["dumb-init", "--"]
# Start using the startup script for better log visibility and to ensure environment variables are sourced
CMD ["./start.sh"]
