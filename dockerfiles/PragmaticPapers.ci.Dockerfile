# Dockerfile for Pragmatic Papers images built in GitHub Actions (#1067)
#
# PragmaticPapers.Dockerfile is built by Coolify on its own build server, which can
# reach the database: it copies and migrates the deployment's database while building,
# and prerenders from it. This one builds on a GitHub runner, which never gets a route
# to our database or its password. So:
#
#   - `next build` runs against a throwaway Postgres the workflow starts next to the
#     build (DATABASE_URI is a build arg pointing at it, not a secret).
#   - The database work moves to container start (start.sh, BUILT_WITHOUT_DATABASE):
#     name and copy the preview's database, drop closed PRs' copies, and migrate
#     (Payload's prodMigrations, when it starts).
#   - start.sh then throws away what the build prerendered from the empty database
#     (/next/revalidate-all), so every route renders from the real one.
#
# It stays a separate file while Coolify still builds staging and production from the
# other one: Coolify injects its variables into every RUN that has no secret mount of
# its own, so the explicit mounts below would strip the rest of its variables there.
#
# Build (see .github/workflows/preview-image.yml):
#   docker buildx build -f dockerfiles/PragmaticPapers.ci.Dockerfile --network host \
#     --secret id=GH_FONT_READ,env=GH_FONT_READ --build-arg DATABASE_URI=... .
ARG NODE_VERSION=24.15.0

# ============================================
# Base stage - setup pnpm and environment
# ============================================
FROM node:${NODE_VERSION}-alpine AS base
RUN apk add --no-cache libc6-compat

ENV PNPM_HOME="/pnpm" \
    PATH="/pnpm:$PATH"

RUN --mount=type=bind,source=package.json,target=package.json \
    corepack enable \
    && corepack prepare "$(node -p "require('./package.json').packageManager")" --activate

WORKDIR /app

# ============================================
# Builder stage - install deps and build
# ============================================
FROM base AS builder
RUN apk add --no-cache git

COPY pnpm-lock.yaml .npmrc pnpm-workspace.yaml ./

# GH_FONT_READ authenticates the @digitalgroundgame registry in .npmrc.
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    --mount=type=secret,id=GH_FONT_READ,env=GH_FONT_READ \
    pnpm fetch --store-dir /pnpm/store

COPY package.json ./
COPY scripts/install-fonts.ts scripts/ansi.mjs scripts/Inter-Bold.woff2 ./scripts/

# A deploy must ship the real FKScreamer (see PragmaticPapers.Dockerfile).
ENV FONTS_REQUIRED=true

RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    --mount=type=secret,id=GH_FONT_READ,env=GH_FONT_READ \
    HUSKY=0 CI=true pnpm install --frozen-lockfile --offline --store-dir /pnpm/store

COPY . .

# None of these is a secret: DATABASE_URI points at the workflow's throwaway database
# and PAYLOAD_SECRET only has to exist for the build. The deployment's real values
# come from Coolify at runtime.
ARG DATABASE_URI
ARG PAYLOAD_SECRET=build-only
ARG BUILD_ENV=preview
ARG COOLIFY_FQDN=
ARG SOURCE_COMMIT=
ARG USE_LOCAL_STORAGE=true
ARG NEXT_PUBLIC_SERVER_URL
ARG NEXT_PUBLIC_GOOGLE_ANALYTICS_ID
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SENTRY_DSN
ARG NEXT_PUBLIC_TURNSTILE_SITE_KEY

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    DATABASE_ADAPTER=postgres \
    BUILD_ENV=${BUILD_ENV} \
    COOLIFY_FQDN=${COOLIFY_FQDN} \
    USE_LOCAL_STORAGE=${USE_LOCAL_STORAGE} \
    NEXT_PUBLIC_SERVER_URL=${NEXT_PUBLIC_SERVER_URL} \
    NEXT_PUBLIC_GOOGLE_ANALYTICS_ID=${NEXT_PUBLIC_GOOGLE_ANALYTICS_ID} \
    NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL} \
    NEXT_PUBLIC_SENTRY_DSN=${NEXT_PUBLIC_SENTRY_DSN} \
    NEXT_PUBLIC_TURNSTILE_SITE_KEY=${NEXT_PUBLIC_TURNSTILE_SITE_KEY}

# Migrate the throwaway database first: the build reads the schema, and Payload's
# prodMigrations stays off here, so parallel prerender workers never race to apply them.
# A fresh runner has no Turbopack cache to go corrupt, so this skips build-next.sh.
RUN echo "--- PHASE: MIGRATING THE BUILD DATABASE ---" && \
    pnpm payload migrate && \
    echo "--- PHASE: BUILDING NEXT.JS ---" && \
    SENTRY_RELEASE="${SOURCE_COMMIT}" pnpm build && \
    echo "--- COMPLETED: BUILDING NEXT.JS ---"

# ============================================
# Runner stage - minimal production runtime
# ============================================
FROM node:${NODE_VERSION}-alpine AS runner
WORKDIR /app

ARG BUILD_ENV=preview

# BUILT_WITHOUT_DATABASE switches on the start-time database work in start.sh and
# Payload's prodMigrations (src/payload.config.ts).
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME="0.0.0.0" \
    BUILD_ENV=${BUILD_ENV} \
    BUILT_WITHOUT_DATABASE=true

# The PostgreSQL client for copy-database.sh, now run here rather than while building.
# Pinned to the server's major version, as in PragmaticPapers.Dockerfile's builder:
# its pg_dump fallback refuses any other.
RUN apk add --no-cache dumb-init libc6-compat postgresql17-client \
    && addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

RUN mkdir -p public/media \
    && chown nextjs:nodejs public/media \
    && chmod 755 public/media

# start.sh finds the others next to itself. The cleanup script runs under Node 24's
# type stripping and loads `pg` from the standalone node_modules.
COPY --from=builder --chown=nextjs:nodejs --chmod=755 \
    /app/dockerfiles/scripts/start.sh \
    /app/dockerfiles/scripts/database-uri.sh \
    /app/dockerfiles/scripts/modify-database-uri.sh \
    /app/dockerfiles/scripts/copy-database.sh \
    /app/dockerfiles/scripts/drop-closed-preview-databases.ts \
    ./

USER nextjs
EXPOSE 3000

# As in PragmaticPapers.Dockerfile. Healthy also means migrated: the first request
# starts Payload, which applies pending migrations before it answers. The start
# period covers a preview's first boot, which copies staging first.
HEALTHCHECK --interval=30s --timeout=5s --start-period=300s --retries=3 \
    CMD wget -q -O /dev/null "http://127.0.0.1:${PORT:-3000}/api/users/me" || exit 1
ENTRYPOINT ["dumb-init", "--"]
CMD ["./start.sh"]
