# Dockerfile for Pragmatic Papers (Next.js + Payload CMS)
# Based on official Next.js Docker deployment guides
ARG NODE_VERSION=22.21.1

# ============================================
# Base stage - setup pnpm and dependencies
# ============================================
FROM node:${NODE_VERSION}-alpine AS base
# Install dependencies for native modules (required for sharp and other native deps)
RUN apk add --no-cache libc6-compat
# Enable pnpm via corepack
RUN corepack enable
WORKDIR /app

# ============================================
# Installer stage - install dependencies only
# ============================================
FROM base AS installer
WORKDIR /app
# Copy entire project
COPY . .

# GitHub Packages auth (set GH_FONT_READ as build arg in Coolify for staging/prod)
ARG GH_FONT_READ
ENV GH_FONT_READ=${GH_FONT_READ}

# Install dependencies with frozen lockfile
# Using cache mount for pnpm store to speed up builds
# Set CI=true to prevent pnpm from requiring TTY
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    CI=true pnpm install --frozen-lockfile

# ============================================
# Builder stage - build the application
# ============================================
FROM base AS builder
WORKDIR /app

# Install PostgreSQL client for database operations
# Only needed if we're copying databases during build
RUN apk add --no-cache postgresql-client

# Copy installed node_modules from installer
COPY --from=installer /app/ .

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

# Build application with migrations
# Runs migrations and then builds
# Source the potentially modified DATABASE_URI before building
RUN . /tmp/build.env && \
    pnpm install --frozen-lockfile && \
    pnpm payload migrate && \
    pnpm build

# ============================================
# Runner stage - minimal production runtime
# ============================================
FROM node:${NODE_VERSION}-alpine AS runner
WORKDIR /app
# dumb-init ensures proper signal handling (SIGTERM) for Node.js
RUN apk add --no-cache dumb-init

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

# Copy the standalone Next.js build
# The standalone build includes a minimal server.js and only necessary node_modules
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
# Copy static assets (required for standalone mode)
# These are not included in standalone by default as they should be served by CDN
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# Copy public folder (images, fonts, etc.)
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# PERSISTENCE FIX: Copy the unique DATABASE_URI from the Builder stage to the Runner stage
COPY --from=builder --chown=nextjs:nodejs /tmp/build.env /app/build.env

# Prepare media directory for local storage deployments
RUN mkdir -p /app/public/media && \
  chown -R nextjs:nodejs /app/public/media && \
  chmod -R 755 /app/public/media

# STARTUP SCRIPT: Sources the isolated DB URI if it exists, otherwise uses defaults
RUN echo '#!/bin/sh' > /app/start.sh && \
    echo 'set -e' >> /app/start.sh && \
    # Source the build.env to get the potentially modified DATABASE_URI for preview deployments
    echo 'if [ -f /app/build.env ]; then . /app/build.env; fi' >> /app/start.sh && \
    echo 'echo "========================================="' >> /app/start.sh && \
    echo 'echo "Starting Pragmatic Papers Application"' >> /app/start.sh && \
    echo 'echo "Node version: $(node --version)"' >> /app/start.sh && \
    echo 'echo "Environment: $NODE_ENV"' >> /app/start.sh && \
    echo 'echo "Database: PostgreSQL"' >> /app/start.sh && \
    echo 'echo "Port: $PORT"' >> /app/start.sh && \
    echo 'echo "Hostname: $HOSTNAME"' >> /app/start.sh && \
    echo 'echo "Log Level: ${PAYLOAD_LOG_LEVEL:-info (default)}"' >> /app/start.sh && \
    echo 'echo "Storage: $([ \"$USE_LOCAL_STORAGE\" = \"true\" ] && echo \"Local\" || echo \"S3\")"' >> /app/start.sh && \
    echo 'echo "========================================="' >> /app/start.sh && \
    echo 'echo "Starting Next.js server..."' >> /app/start.sh && \
    echo 'exec node --trace-warnings server.js' >> /app/start.sh && \
    chmod +x /app/start.sh && \
    chown nextjs:nodejs /app/start.sh

# Switch to non-root user
USER nextjs
# Expose port for Next.js application
EXPOSE 3000
# Use dumb-init to handle signals properly (SIGTERM, etc.)
ENTRYPOINT ["dumb-init", "--"]
# Start using the startup script for better log visibility and to ensure environment variables are sourced
CMD ["/app/start.sh"]
