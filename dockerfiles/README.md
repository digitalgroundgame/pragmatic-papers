# Dockerfiles & Deployment

Docker configurations for deploying applications to staging, preview, and production environments using PostgreSQL.

> **For local development**, see the docker-compose files in individual application directories.

## 📦 Files

**Dockerfiles:**

- `PragmaticPapers.Dockerfile` - Pragmatic Papers (Next.js + Payload CMS)
- `PragmaticPapers.ci.Dockerfile` - the same app, built in GitHub Actions for PR previews (see [Previews built in GitHub Actions](#previews-built-in-github-actions))

**Environment Template:**

- `.env.example` - Environment variables for all applications

## 🚀 Quick Deploy to Coolify

### 1. Generate Secrets

```bash
openssl rand -base64 32  # For PAYLOAD_SECRET
```

### 2. Create Service in Coolify

- **Type:** Dockerfile
- **Dockerfile:**
  - Pragmatic Papers: `dockerfiles/PragmaticPapers.Dockerfile`
- **Base directory:** `/`

### 3. Set Environment Variables

See `.env.example` for all available options. Required configuration:

**For Staging:**

```env
BUILD_ENV=staging
PAYLOAD_SECRET=<generated_secret>
SERVER_URL=https://your-domain.com
DATABASE_URI=postgresql://postgres:<password>@postgres:5432/<dbname>
USE_LOCAL_STORAGE=true
```

**For Preview (with automatic database naming):**

```env
BUILD_ENV=preview
PAYLOAD_SECRET=<generated_secret>
SERVER_URL=https://your-domain.com
DATABASE_URI=postgresql://postgres:<password>@postgres:5432/<dbname>
USE_LOCAL_STORAGE=true
# COOLIFY_FQDN is automatically set by Coolify (e.g., pr-330.pragmaticpapers.com)
# Database name will be automatically suffixed with PR number
```

**For Production:**

```env
BUILD_ENV=production
PAYLOAD_SECRET=<generated_secret>
SERVER_URL=https://your-domain.com
DATABASE_URI=postgresql://postgres:<password>@postgres:5432/<dbname>

# For Pragmatic Papers with S3 storage:
USE_LOCAL_STORAGE=false
S3_REGION=us-east-1
S3_BUCKET=your-bucket
S3_ACCESS_KEY_ID=your-key
S3_SECRET_ACCESS_KEY=your-secret
S3_ENDPOINT=https://s3.amazonaws.com
SUPABASE_URL=https://<project>.supabase.co
```

**Sentry (every Coolify deployment — production, staging and previews):**

- `SENTRY_AUTH_TOKEN` — mark it available at build time; `next build` uses it to upload source maps, so errors from that deployment have readable stack traces. GitHub Actions doesn't get it: CI builds are never served, so there's nothing to symbolicate.
- `SENTRY_DSN` — one DSN for the server, edge and browser SDKs (it replaces `NEXT_PUBLIC_SENTRY_DSN`, which nothing reads any more). The server reads it when it starts, and the root layouts hand it to the browser SDK on `<html>` (`src/sentryConfig.ts`), so give it both **Build Variable** and **Runtime Variable**, like the variables below. Unset, nothing reports to Sentry.
- The Sentry environment is `BUILD_ENV` (`production`, `staging` or `preview`); there's no separate variable for it. Preview errors also carry a `pr` tag (e.g. `986`) taken from `COOLIFY_FQDN`, so filter on `pr:986` to see one PR's. Both are read when the server starts, not compiled in.
- Turn on **Include Source Commit in Build** so Coolify passes `SOURCE_COMMIT` into the build. `.git` is excluded from the Docker context, so the Dockerfile uses it as `SENTRY_RELEASE`; without it, releases (and every browser error's release tag) come out empty.

**Cloudflare cache purge (every Coolify deployment — production, staging and previews):**

Public pages are cached at Cloudflare's edge for 10 minutes, then served stale for up to a day while they revalidate (`next.config.ts`, and the zone's Cache Rules in `cloudflare/`). When an editor saves a global (Site Settings, Header, Footer) or publishes, changes or deletes a document readers see, the save's `revalidate*` hook asks Cloudflare to purge **this deployment's hostname** (from `SERVER_URL`), so anonymous readers get the change at once (`src/hooks/purgeEdgeCache.ts`). Only the hostname: the three environments share one zone, so a "purge everything" from a preview would empty production's cache too.

- `CLOUDFLARE_ZONE_ID` — the zone's ID, from its Overview page in the Cloudflare dashboard.
- `CLOUDFLARE_PURGE_TOKEN` — a custom API token with **Zone → Cache Purge → Purge**, on this zone only. Keep it apart from `CLOUDFLARE_API_TOKEN` (a GitHub secret that deploys Storybook) and the Cache Rules tokens (`cloudflare/README.md`).
- Both are **Runtime Variables** only; the build never reads them. Set them in the production, staging **and** preview apps.
- Unset (or with `SERVER_URL` on localhost), each save logs `Skipping Cloudflare purge (…) — … set CLOUDFLARE_ZONE_ID, CLOUDFLARE_PURGE_TOKEN` and carries on. A purge Cloudflare refuses is logged as a warning, never thrown at the save.
- Purges within a second of each other go out as one request. Hostname purges are rate-limited per account (5 a minute on the Free plan, more on paid plans); a refused one just leaves the edge to expire on its own.

### 4. Configure Domain

- **Application:** Port `3000` → `your-domain.com`

### 5. Deploy

Click **Deploy** in Coolify. The application will:

- ✓ Connect to PostgreSQL database
- ✓ Run migrations automatically during build
- ✓ Start serving on port 3000

## ⚙️ Architecture

```
┌─────────────────┐
│  Application    │
│     :3000       │
└────────┬────────┘
         │
┌────────▼────────┐
│   PostgreSQL    │
│  (External DB)  │
└─────────────────┘
```

Use managed PostgreSQL service (AWS RDS, Supabase, Neon, etc.) for all deployments.

### Our Coolify setup

| Coolify application | Deploys                | `BUILD_ENV`  | Built by                               |
| ------------------- | ---------------------- | ------------ | -------------------------------------- |
| **staging**         | The `dev` branch       | `staging`    | Coolify's build server                 |
| **preview**         | Each PR, at `pr-<n>.…` | `preview`    | GitHub Actions; a **Docker Image** app |
| **production**      | The `main` branch      | `production` | Coolify's build server                 |

- **staging** deploys `dev`, not the live site. Its own preview deployments are off: the **preview** app serves the `pr-<n>` hostnames (see [Previews built in GitHub Actions](#previews-built-in-github-actions)).
- **Two servers run them:** `dev-worker` runs staging and the previews, and hosts the `docker-registry` service staging's images are pulled from; `prod-worker` runs production, apparently pulling from the same registry.
- **Staging and production build on one Coolify build server, one build at a time**, so a `dev` deploy can delay a `main` deploy behind it. The build caches below (`/pnpm`, `/nextjs`) are shared by both. The build server has 8 GB of RAM and a build peaks at ~4.6 GB, so two concurrent builds wouldn't fit. Keep that headroom in mind before adding build steps or dependencies that raise build memory. Previews never use it: they build on GitHub runners.
- **Previews only deploy PRs from people with access to the repo**: same-repo PRs from owners, members and collaborators (the "Plan preview" job in `playwright.yml`). Keep it that way: a preview runs on dev-worker beside staging, with staging's media mounted read-write.

What Coolify's docs say about behaviour that matters to this setup (read them with the `upstream-docs` skill, `coolify` source; paths are under `content/docs/`):

- **Preview variables are a separate group.** An app's **Production Environment Variables** are for its own deployment; its **Preview Deployment Environment Variables** are for its previews. Changing a value for both means changing it twice (`applications/deployments/preview-deployments.mdx`).
- **Closing a PR deletes its preview's containers, not its database.** Data a preview wrote to an external service stays, so each preview's `pragmatic_papers_pr_<n>` copy of staging outlives the PR; later preview builds drop it (see [Dropping closed PRs' preview databases](#dropping-closed-prs-preview-databases)).
- **Build secrets need BuildKit.** With **Use Docker Build Secrets** on, Coolify mounts build-time variables as secrets; without BuildKit it silently falls back to build arguments, which can show in the image's metadata (`applications/configuration/environment-variables.mdx`). Each variable also has independent **Build Variable** / **Runtime Variable** toggles; turn **Build Variable** off for secrets the build doesn't read.
- **Old images are kept for rollback**, a configured number per app, and Docker cleanup skips them unless **Disable Application Image Retention** is on. A rollback runs an old image with the _current_ variables (`applications/deployments/rollbacks.mdx`, `core/infrastructure/servers/automated-docker-cleanup.mdx`).
- **Deployment logs can't be cleared.** The docs describe no way to delete a deployment's log, so anything a build prints stays readable to whoever can open the app in Coolify (#1066).

## 🧱 Build Cache and Environment Variables

Coolify passes every build-time variable into the Dockerfile as a BuildKit secret, mounted as an env var into **every** `RUN` (`--mount=type=secret,id=X,env=X`). That includes `SOURCE_COMMIT` when **Include Source Commit in Build** is on. What that means for the layer cache (verified 2026-09-26):

- **Variable _names_ are part of each step's cache key; _values_ are not.** Adding or removing a variable in an application gives its next build a cold cache. Changing a value doesn't invalidate anything: a step can be reused with output built from the old value.
- **So every step whose output depends on a value must come after `COPY . .`**, which reruns on every deploy. That covers migrations (`DATABASE_URI`) and `next build` (`SERVER_URL`, `SENTRY_RELEASE`). Only value-independent steps belong above it: system packages and the dependency install.
- **Staging and previews keep separate caches** because their variable names differ (below). Sharing would only save the dependency install on each one's first build of the day, so they aren't kept in sync for that.
- **Redeploys:** an unchanged commit on staging/production reuses its existing image ("No build configuration changed & image found"). PR previews always rebuild, reusing cached layers up to `COPY . .`.
- **Server cleanup:** Coolify's Docker cleanup runs `docker builder prune -af`, which removes all build cache, including the pnpm-store and `.next/cache` mounts. Keep its trigger on a **disk-usage threshold** rather than "Run on every schedule", or every day's first build starts cold.
- **Corrupt Turbopack cache:** the `.next/cache` mount (`id=nextjs`) is shared by every app and branch on the server. A build killed mid-compile (out of memory, a cancelled deploy) can leave it half-written, and every later build then fails within seconds with a `TurbopackInternalError` such as `Failed to restore data for task`. `dockerfiles/scripts/build-next.sh` recognises Turbopack's cache-storage errors, deletes `.next/cache/turbopack` and builds once more; the mount is `sharing=locked`, so two builds never write it at once. To clear it by hand on the build server: `docker buildx prune -f --filter id=$(docker buildx du --verbose | grep -B6 'id "/nextjs"' | awk '/^ID:/{print $2}')`.

### Variables that differ between staging and previews

Snapshot of the variable names each has, from the 2026-09-26 build logs. Production wasn't checked. Keep this list current when you add or remove one.

| Variable                        | Staging | Previews | Blank / unset means                                                                            |
| ------------------------------- | ------- | -------- | ---------------------------------------------------------------------------------------------- |
| `COPY_SOURCE_DATABASE`          | —       | set      | no database copy (`copy-database.sh` checks `!= "true"`)                                       |
| `FORCE_DATABASE_COPY`           | —       | set      | don't drop an existing copy (checks `= "true"`)                                                |
| `SEED_ENABLED`                  | —       | set      | nothing — no code reads it (from an unmerged branch); delete it                                |
| `LISTMONK_NEWSLETTER_LIST_UUID` | set     | —        | Listmonk calls throw "Missing required env var", so newsletter signup doesn't work on previews |

`NEXT_PUBLIC_*` variables are compiled into the image when it builds, in server code as well as browser code, so changing one in Coolify would need a rebuild. None is read any more: `SERVER_URL`, `TURNSTILE_SITE_KEY`, `GOOGLE_ANALYTICS_ID`, `SENTRY_DSN` and `SUPABASE_URL` are read by the server instead. They replace `NEXT_PUBLIC_SERVER_URL`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `NEXT_PUBLIC_GOOGLE_ANALYTICS_ID`, `NEXT_PUBLIC_SENTRY_DSN` and `NEXT_PUBLIC_SUPABASE_URL`.

- **In an app Coolify builds** (staging, production), give each one both **Build Variable** and **Runtime Variable**. Pages rendered during the build read the build's value, and `next.config.ts` reads `SERVER_URL` while building. Pages rendered later read the container's value.
- **In the preview app**, set them as runtime variables. `start.sh` re-renders every page once the server starts.
- **`SERVER_URL` is the site's origin, with no trailing slash.** Production uses its canonical URL, `https://pragmaticpapers.com` (the same value as `PRODUCTION_URL` in the clone-from-production endpoint). Staging uses its own domain. Previews use `$COOLIFY_URL`, the URL Coolify gives each preview (**Preview Deployment Environment Variables**). An app with more than one domain should use a literal URL, because `COOLIFY_URL` lists all of them.
- **Unset,** `SERVER_URL` fails a Coolify build (the Dockerfile checks it before `next build`), and `start.sh` refuses to start without it, so a deploy missing it never replaces the running container. Outside a deployed image (no `BUILD_ENV`) it falls back to `http://localhost:8000`. Without `TURNSTILE_SITE_KEY` the signup form renders with no challenge, and the subscribe route rejects it. Without `GOOGLE_ANALYTICS_ID` pages render with no analytics tag.

Code should treat a blank value the same as an unset one, since a variable can exist with no value. The shell checks above do. In TypeScript, prefer `process.env.X || fallback` over `process.env.X ?? fallback` wherever blank should fall back: `??` keeps `""`.

## 🔍 Common Issues

**Build failures:**

- Ensure all required environment variables are set in Coolify
- Required: `PAYLOAD_SECRET`, `SERVER_URL`, and `DATABASE_URI`
- Verify PostgreSQL database is accessible during build (migrations run at build time)

**Database connection errors:**

- Verify `DATABASE_URI` connection string format: `postgresql://user:password@host:port/database`
- Ensure PostgreSQL service is accessible from your deployment
- Check database credentials and permissions

## 🔒 Production Notes

### For All Deployments:

1. Use managed PostgreSQL (AWS RDS, Supabase, Neon, etc.)
2. Generate strong secrets: `openssl rand -base64 32`
3. Configure CDN for static assets (Pragmatic Papers with S3)
4. Set up automated database backups
5. Enable monitoring and alerting

## 📝 Data Persistence

### PostgreSQL Database:

- Use managed PostgreSQL service for all environments
- Configure automated backups through your provider
- Data persistence handled by database service
- Migrations run automatically during Docker build

### Media Storage (Pragmatic Papers):

- **Staging/Preview**: Local storage with persistent volumes
- **Production**: S3-compatible storage (recommended)

## 🗄️ Database Configuration

Pragmatic Papers uses PostgreSQL exclusively for Docker deployments.

### PostgreSQL Configuration

```env
DATABASE_URI=postgresql://postgres:password@postgres:5432/pragmatic_papers
```

**Benefits:**

- ✅ Production-ready for all environments
- ✅ Robust and scalable
- ✅ Better for high concurrency
- ✅ Advanced querying capabilities
- ✅ Reliable data persistence
- ✅ Industry-standard database

**How it works:**

1. Requires external PostgreSQL database service
2. Database connection via `DATABASE_URI`
3. Migrations run automatically during build
4. Data persisted by PostgreSQL service

**Recommended Managed Services:**

- **AWS RDS** - Enterprise-grade, highly available
- **Supabase** - PostgreSQL with built-in APIs and auth
- **Neon** - Serverless PostgreSQL with branching
- **DigitalOcean Managed Databases** - Simple and affordable
- **Railway** - Developer-friendly platform
- Or run your own PostgreSQL instance

### Preview Deployments on the PR (GitHub Deployments)

Coolify only comments on the PR; it doesn't create GitHub Deployments ([coollabsio/coolify#9583](https://github.com/coollabsio/coolify/issues/9583)). For the previews built in GitHub Actions, `playwright.yml`'s "Deploy preview" job creates the Deployment and mirrors Coolify's status onto it (`scripts/preview-deployment.ts`). This section covers the fallback, previews staging builds itself (see [Falling back](#previews-built-in-github-actions)), where `.github/workflows/preview-deployment.yml` fills the gap: on each push to a PR it waits for Coolify to queue the preview build for that commit, then creates a Deployment for the PR's branch in the **Preview** environment and copies Coolify's status onto it. The PR then shows the build as queued, in progress, failed or live, with **View deployment** linking to `pr-<n>.pragmaticpapers.com`. There's deliberately no log link to the build in Coolify: Deployments are public on this repo, and it would publish the Coolify dashboard's address. Older previews of the PR go inactive when a newer one goes live, and all of them when the PR closes.

Set these under **Settings → Secrets and variables → Actions**:

| Name                       | Kind     | Value                                                                                                                |
| -------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------- |
| `COOLIFY_API_TOKEN`        | secret   | A Coolify API token with `read` access (**Keys & Tokens → API tokens**; enable the API under **Settings**)           |
| `COOLIFY_DASHBOARD_URL`    | variable | The Coolify server's URL, e.g. `https://coolify.example.com` (with or without `/api/v1`)                             |
| `COOLIFY_PREVIEW_APP_UUID` | variable | The **staging** app's UUID, for the fallback (the last segment of its dashboard URL)                                 |
| `PREVIEW_URL_TEMPLATE`     | variable | Optional. The app's preview URL template in Coolify's syntax; defaults to `https://pr-{{pr_id}}.pragmaticpapers.com` |

Until all three required values are set, or while `COOLIFY_PREVIEW_IMAGE_APP_UUID` is set, the workflow does nothing. It also skips the PRs Coolify doesn't preview while **public PR deployments** are off in Coolify: PRs from forks, PRs whose author isn't an owner, member or collaborator of the repo (Dependabot's included), and PRs titled `[skip ci]` or `[skip cd]`. If you turn public PR deployments on, widen the job's `if` to match. Any other PR Coolify doesn't build gets no Deployment; the job gives up after waiting 10 minutes. If the build runs longer than 45 minutes, the Deployment is marked as errored.

### Automatic Database Naming for Preview Deployments (Coolify)

When deploying with Coolify, preview deployments automatically get unique database names based on the `COOLIFY_FQDN` environment variable.

**How it works:**

When `BUILD_ENV=preview` and Coolify sets `COOLIFY_FQDN` (e.g., `pr-330.pragmaticpapers.com`), the Dockerfile will:

1. Extract the prefix (`pr-330`)
2. Sanitize it for database naming (`pr_330`)
3. Append it to your database name

**Example:**

```env
# Your base configuration
BUILD_ENV=preview
DATABASE_URI=postgresql://postgres:password@db.example.com:5432/pragmatic_papers

# Coolify sets this automatically for PR #330
COOLIFY_FQDN=pr-330.pragmaticpapers.com

# Result: Database name becomes "pragmatic_papers_pr_330"
# Full URI: postgresql://postgres:password@db.example.com:5432/pragmatic_papers_pr_330
```

**Benefits:**

- ✅ Automatic unique database per preview deployment
- ✅ No manual configuration needed
- ✅ Clean isolation between preview environments
- ✅ Easy to identify which database belongs to which PR
- ✅ Only activates for `BUILD_ENV=preview` (staging/production unaffected)

**Note:** For staging and production deployments, set `BUILD_ENV` to `staging` or `production`, and the original `DATABASE_URI` will be used as-is regardless of `COOLIFY_FQDN`.

### Database Copy for Preview Deployments

With `COPY_SOURCE_DATABASE=true`, a preview's database starts as a copy of the database its `DATABASE_URI` names, so it has that database's content (articles, pages, Site Settings experiments) while its migrations run on the copy.

```env
BUILD_ENV=preview
COPY_SOURCE_DATABASE=true
DATABASE_URI=postgresql://user:pass@db.example.com:5432/pragmatic_papers

# Optional, default false. WARNING: drops and recreates an existing preview database
FORCE_DATABASE_COPY=false
```

**What happens for PR #330** (`COOLIFY_FQDN=pr-330.pragmaticpapers.com`):

1. `modify-database-uri.sh` names the preview database `pragmatic_papers_pr_330` and writes only that name to `/tmp/database_name`. A preview build without `COOLIFY_FQDN` fails instead of falling back to the database every preview shares.
2. `copy-database.sh` creates it as a copy of `pragmatic_papers`, on the same server and with `DATABASE_URI`'s credentials. It tries `CREATE DATABASE … WITH TEMPLATE` first, which only works while nothing is connected to the source; with staging's app running it falls back to `pg_dump`/`pg_restore`. It never disconnects the source's clients: doing so failed whatever staging was serving. If the dump or restore fails, the half-restored database is dropped, so the next build copies again.
3. It leaves an existing preview database alone unless `FORCE_DATABASE_COPY=true`. Then the previous deploy's container is still using it, so the script copies into `pragmatic_papers_pr_330_incoming`, migrates that, and only then drops the old database and renames the copy into place. The running preview is never left on a missing or unmigrated database; if the migration fails, the build fails and the old database is kept.
4. Migrations and `next build` run against the preview database.
5. The runner image carries `/app/database_name`, and `start.sh` applies it to the runtime `DATABASE_URI`. No credential is written into the image.

**Requirements:**

- `DATABASE_URI` must be available at build time _and_ runtime, with the same value, in **every** environment: the image carries no credentials, so the running app reads only the runtime value, and `start.sh` exits if it's missing.
- Its user needs `CREATEDB`, read access to the source database (for `pg_dump`), and permission to terminate sessions on **preview** databases (for a forced recopy). It never terminates sessions on the source.
- **The builder's `pg_dump` must match the server's major version.** With staging's app connected, dump/restore is the usual path for a new preview, not the exception. An older `pg_dump` refuses a newer server, and a newer one writes settings an older server's restore rejects. The builder stage's `apk add` pins `postgresql17-client` to match the server; Alpine's unpinned `postgresql-client` follows the Alpine release under the Node image and had moved on to 18, which failed preview builds whose template copy was refused. `copy-database.sh` compares the two before creating anything, prints `pg_dump major version: N; server: M` in the build log, and fails the build with the package to install when they differ. `PragmaticPapers.ci.Dockerfile` pins the same package in its runtime stage, where the copy runs for images built in GitHub Actions. **Upgrading the database server means bumping both pins in the same change.**
- **A dump holds `ACCESS SHARE` locks on staging's tables while it runs.** If a staging deploy runs `payload migrate` at the same time, an `ALTER TABLE` waits for them, and staging's queries queue behind that `ALTER`. While the database is small this lasts seconds; if staging ever hangs during a deploy, check whether a preview build was copying at the time.

**Running commands inside a preview container:** only `start.sh` points `DATABASE_URI` at the preview's own database. A shell opened with `docker exec` or Coolify's terminal still has the unsuffixed `DATABASE_URI`, which is **staging's** database. Apply the preview name first:

```sh
. /app/database-uri.sh && use_preview_database /app/database_name
```

**For Staging/Production:**
Set `BUILD_ENV=staging` or `BUILD_ENV=production` and leave `COPY_SOURCE_DATABASE` unset: the naming and the copy are both skipped, using your `DATABASE_URI` exactly as configured.

### Previews built in GitHub Actions

Previews are built off the Coolify build server, so they don't queue in front of `dev` and `main` deploys or compete for its memory: `.github/workflows/playwright.yml` builds each PR's image on a GitHub runner (`.github/actions/build-app-image`), pushes it to GHCR, and has the **preview** app run it as the PR's preview; `preview-image.yml` removes it when the PR closes. `COOLIFY_PREVIEW_IMAGE_APP_UUID` is the switch: cleared, previews fall back to building on staging as described above.

**The preview is the image E2E tested.** Nothing environment-specific is built in: `SERVER_URL` and the rest are read at runtime. What the build prerenders from its localhost default (the feeds, `robots.txt` and the sitemap index) is re-rendered once the server starts, when `/next/revalidate-all` is called. So the same image serves E2E on `http://localhost:8000` and the preview on `pr-<n>.pragmaticpapers.com`. The "E2E tests" job starts it with `node server.js` rather than `start.sh`: there's no preview database to name or copy, and `scripts/test-e2e.mjs` seeds, copies the uploads in and calls `/next/revalidate-all` itself.

**Where each step runs.** The runner never gets a route to our database or its password, so the database work moves to the container:

| Step                                 | Coolify build (`PragmaticPapers.Dockerfile`) | GitHub Actions (`PragmaticPapers.ci.Dockerfile`)                                              |
| ------------------------------------ | -------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Name the preview's database          | while building                               | at container start, from the runtime `COOLIFY_FQDN`                                           |
| Copy staging into it                 | while building                               | at container start (first boot only)                                                          |
| Drop closed PRs' databases           | while building                               | at container start                                                                            |
| Migrate                              | `payload migrate` while building             | when Payload starts (`prodMigrations`), before the health check passes                        |
| `next build`                         | against the preview's database               | against a throwaway Postgres beside the job                                                   |
| Routes prerendered from the database | served as built                              | thrown away once the server is up (`POST /next/revalidate-all`), then rendered from real data |

The image sets `BUILT_WITHOUT_DATABASE=true`, which switches on the start-time steps in `start.sh` and `prodMigrations` in `src/payload.config.ts`. Images Coolify builds don't set it, so staging and production do that work while building. Differences from a Coolify-built preview:

- **First boot takes longer**: it copies staging before the server starts, so the health check below allows 5 minutes before counting failures.
- **`FORCE_DATABASE_COPY=true` swaps the fresh copy in unmigrated.** There's no Payload CLI in the image, so the new container migrates it as it starts, and the old container serves the unmigrated copy until then.
- **`FORCE_DATABASE_COPY=true` copies once per image, not once per start.** The copy runs whenever the container starts, restarts included, so the script marks the database with the image's commit (a Postgres comment) and skips the forced copy when the mark matches. Restarting a preview keeps what testers entered; deploying a new commit copies afresh. Still turn it back off once the preview you meant to refresh has been redeployed.

**Setup.** In Coolify:

1. The **preview** app is a **Docker Image** application in the same project as staging, on the server and destination staging deploys to, with image `ghcr.io/digitalgroundgame/pragmatic-papers-preview`. Any tag will do (e.g. `unused`): each preview deploy sends its own, and the app's own deployment is never run. Then:
   - **Exposed port** `3000` (the default is 80).
   - **Keep a domain on the app** (`https://…`). Coolify only generates a preview's URL when the app has one, and takes the preview's scheme from it (`ApplicationPreview::generate_preview_fqdn`).
   - **Preview URL template** `pr-{{pr_id}}.pragmaticpapers.com`, host only: Coolify puts the scheme in front.
   - **Healthcheck on**: GET `/api/users/me` on port `3000`, expecting `200`, with a start period of `300` seconds. Coolify doesn't read the image's own `HEALTHCHECK` for a Docker Image app, and with its check off it swaps a preview in before the copy and migrations have finished.
   - **Healthcheck host** `127.0.0.1`, not `localhost`: the server listens on IPv4 only, and in the Alpine image `localhost` resolves to `::1` first, so the check is refused and Traefik answers 503 "No available server".
   - **Persistent storage**, two mounts. A **volume** at `/app/public/media` (any name): the preview's own uploads. Coolify gives each preview its own copy of the app's volumes, and a fresh volume takes the image's ownership, so the app can write to it. Staging's media folder (`/data/coolify/applications/<its uuid>/public/media`) at `/staging-media`, added as a **Directory mount** (Coolify v4.3.23's Volume mount takes no source path). Coolify mounts a Directory mount's source path as-is for every preview, with no `-pr-<n>` suffix. `start.sh` copies what the preview's volume lacks from it at every start (`cp -n`, so a preview's own uploads are never overwritten), and logs an error when it's empty. The database copy brings staging's media rows but not their files, so without it every image is broken.

     **This mount points at staging's only copy of its media, and Coolify deletes it without asking in three ways** (v4.3.23, `LocalFileVolume`). On 2026-09-30 one of them emptied staging's media folder, and there was no copy to restore from:

     - Saving it as a **File mount** instead of a Directory mount runs `rm -fr` on the source path at once and leaves an empty file there (`saveStorageOnServer`). No confirmation, no backup check.
     - **Convert To File** and permanent **Delete** run `rm -rf` on the source path (`deleteStorageOnServer`). Both refuse while the mount has a backup schedule, but there's none until you add one.

     So, in this order:

     1. On the server, copy staging's media somewhere Coolify doesn't manage: `cp -a /data/coolify/applications/<uuid>/public/media /root/staging-media-$(date +%F)`.
     2. Add the mount as a **Directory mount**. Double-check the type before saving.
     3. Straight away, click **Configure Backup** on it and set a schedule. That locks out Convert To File and Delete, and backs up staging's media from then on.

     Never edit the mount afterwards; delete it only after removing its backup schedule and copying staging's media again. `start.sh` only reads `/staging-media`, but Coolify has no read-only option for a Docker Image app's mounts, so it is mounted read-write. What keeps previews off staging's files is that only `start.sh` touches that path, and previews only deploy PRs from trusted authors (the "Plan preview" job in `playwright.yml`).
2. Its variables are all **runtime** variables: `DATABASE_URI`, `COPY_SOURCE_DATABASE`, `FORCE_DATABASE_COPY`, `PAYLOAD_SECRET`, `USE_LOCAL_STORAGE`, `SERVER_URL=$COOLIFY_URL`, `TURNSTILE_SITE_KEY`, `GOOGLE_ANALYTICS_ID`, `SENTRY_DSN` and the rest the app reads at runtime. `BUILD_ENV` is baked into the image. Build variables aren't used: nothing builds in Coolify.
3. Let the server pull from GHCR: the package is private, so log its Docker in to `ghcr.io` (`docker login ghcr.io`, as the user Coolify connects with) with a GitHub token that has `read:packages`.
4. Give `COOLIFY_API_TOKEN` the `deploy` and `write` abilities as well as `read` (the token's owner must be a team admin). The workflow uses them to deploy the image (`POST /api/v1/deploy?uuid=…&pr=…&docker_tag=…`, Coolify `v4.0.0-beta.471` or later) and to remove the preview when the PR closes.

In GitHub (**Settings → Secrets and variables → Actions**):

| Name                             | Kind     | Value                                                               |
| -------------------------------- | -------- | ------------------------------------------------------------------- |
| `COOLIFY_PREVIEW_IMAGE_APP_UUID` | variable | The **preview** app's UUID. Cleared, previews fall back to staging. |
| `PREVIEW_USE_LOCAL_STORAGE`      | variable | Optional; defaults to `true`, as previews use.                      |

`GH_FONT_READ`, `COOLIFY_API_TOKEN`, `COOLIFY_DASHBOARD_URL` and `PREVIEW_URL_TEMPLATE` are shared with the workflows above.

**Falling back to Coolify-built previews.** Clear `COOLIFY_PREVIEW_IMAGE_APP_UUID` and turn staging's preview deployments on: `preview-deployment.yml` follows its builds again, and `playwright.yml` and `preview-image.yml` leave PRs alone. To return, set the variable, then turn staging's preview deployments off and delete its running previews: the two apps would claim the same `pr-<n>` hostnames. Either way each PR's next push redeploys it on the other app, which names databases the same way, so a preview keeps its data.

### Dropping closed PRs' preview databases

Coolify deletes a closed PR's preview containers but not its database, so every preview's copy of staging would stay on the database server. Each preview cleans up after copying (at container start for previews built in GitHub Actions, while building for Coolify-built ones): `dockerfiles/scripts/drop-closed-preview-databases.ts` asks GitHub which PRs are open and drops `pragmatic_papers_pr_<n>` and `pragmatic_papers_pr_<n>_incoming` for every PR that isn't open. It logs each database it drops, by name.

- **It touches nothing else.** A name must be exactly the source database plus `_pr_<number>`, optionally followed by `_incoming`.
- **It skips when unsure.** If GitHub can't be reached, or its open list doesn't include the PR being built (the wrong repository, say), it drops nothing.
- **It keeps anything that might be live.** GitHub's list can miss an open PR, one too new to be listed yet or one that moved between pages while they were read. So a database is kept while anything is connected to it (a live preview's app always is), and when its PR is newer than every PR listed. It never disconnects anyone; a later build retries.
- **It never fails the build.** Any error is logged as `Skipping cleanup: …` and the build carries on.
- **Previews only.** Staging and production builds skip it (`COPY_SOURCE_DATABASE` isn't `true` there).
- **A reopened PR** gets a fresh copy on its next build, like a new one.
- **Credentials:** it reads open PRs from GitHub's public API without a token, which works while the repository is public (60 requests an hour per server, one or two per build). For a private repository, add a `GITHUB_TOKEN` variable to the preview app (runtime) or, for the fallback, staging's preview variables (build): a fine-grained token with read access to pull requests. `GITHUB_REPOSITORY` overrides `digitalgroundgame/pragmatic-papers`.

### Pruning the image registry

Coolify pushes every image it builds to the `docker-registry` resource (a `registry:2` service in the Pragmatic Papers project's **development** environment, running on dev-worker as `registry-<uuid>`), tagged `pr-<n>-<sha>` for a preview. Previews built in GitHub Actions go to GHCR instead, so new `pr-` tags only appear while previews fall back to staging. A registry never deletes anything by itself, so by September 2026 it held 224 tags and 6.5 GB, the largest single use of dev-worker's 38 GB disk after the swap file. `dockerfiles/scripts/prune-registry.sh` trims it. The production app, which runs on `prod-worker`, appears to use the same registry (its settings name the same domain), though in September 2026 the registry held none of `main`'s commits.

It runs as a **Coolify Scheduled Task** on the `docker-registry` service, so its schedule and every run's output are in Coolify, not in a crontab. The task can't run in the registry's own container, which the script stops, so the service has a second container for it:

1. On the `docker-registry` service, **Edit Compose File** and add under `services:`:

   ```yaml
   pruner:
     image: docker:29-cli
     command: ["sleep", "infinity"]
     restart: unless-stopped
     exclude_from_hc: true
     environment:
       - REGISTRY_STORAGE=/registry-data
     volumes:
       - /var/run/docker.sock:/var/run/docker.sock
       - ./data:/registry-data
   ```

   `./data` is the registry's own storage directory (`/data/coolify/services/<uuid>/data`). The Docker socket lets the task stop and start the registry and run garbage collection beside it, which is root on the server: nothing else in the stack gets it. Save and **Restart** the service.

2. Under **Configuration → Scheduled Tasks**, **+ Add**:

   | Field          | Value                                                                                                                                                                    |
   | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
   | Name           | Prune registry                                                                                                                                                           |
   | Command        | `wget -qO /tmp/prune.sh https://raw.githubusercontent.com/digitalgroundgame/pragmatic-papers/<commit>/dockerfiles/scripts/prune-registry.sh && sh /tmp/prune.sh --apply` |
   | Frequency      | `30 4 * * *` (the server's timezone)                                                                                                                                     |
   | Container name | `pruner`                                                                                                                                                                 |
   | Timeout        | `1800`                                                                                                                                                                   |

   `<commit>` is a full commit SHA on `dev`, so the code the task runs with root on the server only changes when someone edits the task. Drop `--apply` and **Execute Now** for a dry run; its output is under **Recent executions**.

While a run collects garbage the registry container is stopped for about a minute, so Coolify may briefly show the service as degraded.

- **What it keeps:** every tag a container on the server runs, the newest 2 tags of each open PR (`KEEP_PER_PR`), every tag of a PR newer than all the open ones GitHub listed (it may be too new to be listed), and the newest 10 tags that aren't a PR's (`KEEP_OTHER`), staging's, for rollbacks. It also keeps every tag named after one of `main`'s 5 newest commits (`KEEP_BRANCHES`, `KEEP_PER_BRANCH`), which it asks GitHub for: production runs on another server, where the script's `docker ps` can't see which tag it runs, and `dev`'s far more frequent deploys would otherwise crowd production's tags out of the ten. In September 2026 the registry held none of `main`'s commits (the last production deploy may predate the registry); which registry production pushes to is its app's **Configuration → General → Docker Registry → Docker Image**. Everything else goes, including every tag of a closed PR.
- **How:** it deletes the tags' directories in the registry's storage, ranking tags by their latest push. Deleting a tag doesn't free its image, which stays registered under `_manifests/revisions`, so it also unregisters every image the deleted tags named and the platform images inside each one. It never unregisters one a kept tag names, or one that an image staying registered lists, such as an unchanged platform image shared by an old build and a new one. Then it runs `registry garbage-collect`, without `--delete-untagged`, in a throwaway container with the registry's volumes and environment. That flag would do the unregistering itself, but Coolify pushes image indexes (BuildKit's attestations), and `registry:2`'s `--delete-untagged` deletes an index's platform images and leaves its tag unpullable ([distribution/distribution#3178](https://github.com/distribution/distribution/issues/3178)). The registry is **stopped** meanwhile, so a push can't land half-collected; a deploy that pushes in that minute fails and needs redeploying, hence 04:30.
- **It deletes nothing when unsure:** if GitHub can't be reached, lists no open PRs or no commits for a kept branch, or fails partway through its pages, it exits 1 before touching the registry. It finds the registry as the only `registry-*` container and its storage as the mount at the path its `REGISTRY_STORAGE_FILESYSTEM_ROOTDIRECTORY` names (Coolify sets `/data`), or `/var/lib/registry`; set `REGISTRY_CONTAINER` if there are several.
- **Private repository:** add `GITHUB_TOKEN` to the `pruner` container's `environment`, a fine-grained token with read access to pull requests.

## 💾 Storage Configuration (Pragmatic Papers)

Pragmatic Papers supports two storage modes for uploaded media files:

### Local Storage (Staging/Preview)

```env
USE_LOCAL_STORAGE=true
```

**Benefits:**

- No S3 credentials needed
- Simpler setup for staging/preview environments
- Files persist via Docker volumes

**Requirements:**

- Configure a persistent mount in Coolify at `/app/public/media` (staging bind-mounts `/data/coolify/applications/<its uuid>/public/media`; previews: see the preview image setup above)
- The app runs as uid `1001` (`nextjs`), so it must be able to write the mount's source folder. When Docker creates a missing bind source it makes it `root`-owned, and every upload fails; fix it with `chown 1001:1001 /data/coolify/applications/<uuid>/public/media`. `start.sh` warns at startup when the folder is missing, empty, or not writable.
- Back up the media folder. It's the only copy of staging's uploads (see the preview mount's warning above).

### S3 Storage (Production)

```env
USE_LOCAL_STORAGE=false
S3_REGION=us-east-1
S3_BUCKET=your-bucket
S3_ACCESS_KEY_ID=your-key
S3_SECRET_ACCESS_KEY=your-secret
S3_ENDPOINT=https://s3.amazonaws.com
SUPABASE_URL=https://<project>.supabase.co
```

`SUPABASE_URL` is where media is served from: `generateFileURL` (`src/plugins/index.ts`) points each file at `<SUPABASE_URL>/storage/v1/object/public/<S3_BUCKET>/…`. It's read when pages render, not compiled in. Give it and `S3_BUCKET` both **Build Variable** and **Runtime Variable**, like `SERVER_URL`: a Coolify build renders the `force-static` feeds (`/feed.articles`, `/feed.volumes`, each article's `substack.xml`) from the database, and without them their images point at `/media/<file>`, which production doesn't have. The feeds keep those URLs until each one next re-renders. `next/image` only loads remote images from hosts `next.config.ts` lists, and that list is fixed when the image builds, so it allows any `https://*.supabase.co` public bucket rather than one project's host. For the same reason `start.sh` refuses to start a deployed image using S3 (`USE_LOCAL_STORAGE` not `true`) whose `S3_BUCKET` or `SUPABASE_URL` is unset, or whose `SUPABASE_URL` isn't a `*.supabase.co` origin or ends in a slash: every image on the site would break. A custom storage domain needs a pattern for it in `next.config.ts`, and in `start.sh`.

**Benefits:**

- Files stored in S3-compatible storage (AWS S3, Supabase Storage, Cloudflare R2, etc.)
- Better scalability and CDN integration
- Automatic redundancy and backups
- Recommended for production deployments

## 🆘 Need Help?

- Check environment variable examples: `.env.*.example`
- Review Coolify logs for build/runtime errors
- Verify health checks in Coolify dashboard. The image's `HEALTHCHECK` requests `/api/users/me` and passes once Payload has started against the database; a container stuck unhealthy usually means `start.sh` exited (check its log for `DATABASE_URI is not set at runtime`) or the database is unreachable
