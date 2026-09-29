# Dockerfiles & Deployment

Docker configurations for deploying applications to staging, preview, and production environments using PostgreSQL.

> **For local development**, see the docker-compose files in individual application directories.

## 📦 Files

**Dockerfiles:**

- `PragmaticPapers.Dockerfile` - Pragmatic Papers (Next.js + Payload CMS)

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
NEXT_PUBLIC_SERVER_URL=https://your-domain.com
DATABASE_URI=postgresql://postgres:<password>@postgres:5432/<dbname>
USE_LOCAL_STORAGE=true
```

**For Preview (with automatic database naming):**

```env
BUILD_ENV=preview
PAYLOAD_SECRET=<generated_secret>
NEXT_PUBLIC_SERVER_URL=https://your-domain.com
DATABASE_URI=postgresql://postgres:<password>@postgres:5432/<dbname>
USE_LOCAL_STORAGE=true
# COOLIFY_FQDN is automatically set by Coolify (e.g., pr-330.pragmaticpapers.com)
# Database name will be automatically suffixed with PR number
```

**For Production:**

```env
BUILD_ENV=production
PAYLOAD_SECRET=<generated_secret>
NEXT_PUBLIC_SERVER_URL=https://your-domain.com
DATABASE_URI=postgresql://postgres:<password>@postgres:5432/<dbname>

# For Pragmatic Papers with S3 storage:
USE_LOCAL_STORAGE=false
S3_REGION=us-east-1
S3_BUCKET=your-bucket
S3_ACCESS_KEY_ID=your-key
S3_SECRET_ACCESS_KEY=your-secret
S3_ENDPOINT=https://s3.amazonaws.com
```

**Sentry (every Coolify deployment — production, staging and previews):**

- `SENTRY_AUTH_TOKEN` — mark it available at build time; `next build` uses it to upload source maps, so errors from that deployment have readable stack traces. GitHub Actions doesn't get it: CI builds are never served, so there's nothing to symbolicate.
- The Sentry environment is `BUILD_ENV` (`production`, `staging` or `preview`); there's no separate variable for it. Preview errors also carry a `pr` tag (e.g. `986`) taken from `COOLIFY_FQDN`, so filter on `pr:986` to see one PR's.
- Turn on **Include Source Commit in Build** so Coolify passes `SOURCE_COMMIT` into the build. `.git` is excluded from the Docker context, so the Dockerfile uses it as `SENTRY_RELEASE`; without it, releases (and every browser error's release tag) come out empty.

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

| Coolify application | Environment    | Deploys                | `BUILD_ENV`  |
| ------------------- | -------------- | ---------------------- | ------------ |
| **development**     | **preview**    | Each PR, at `pr-<n>.…` | `preview`    |
| **development**     | **production** | The `dev` branch       | `staging`    |
| **production**      | **production** | The `main` branch      | `production` |

- The development app's **production** environment is what these docs call **staging**: it deploys `dev`, not the live site.
- **Every deployment builds on one Coolify build server, one build at a time**, so a queue of preview builds delays a `dev` or `main` deploy behind it. The build caches below (`/pnpm`, `/nextjs`) are shared by all three. The build is memory-hungry; see [#1018](https://github.com/digitalgroundgame/pragmatic-papers/issues/1018) before adding build steps or dependencies that raise build memory.
- **Public PR deployments are off**, so previews only build for PRs from people with access to the repo (see [Preview Deployments on the PR](#preview-deployments-on-the-pr-github-deployments)). Keep it that way: previews build on the same server as the live site.

What Coolify's docs say about behaviour that matters to this setup (read them with the `upstream-docs` skill, `coolify` source; paths are under `content/docs/`):

- **Preview variables are a separate group.** The development app's **Production Environment Variables** are staging's; **Preview Deployment Environment Variables** are the previews'. Changing a value for both means changing it twice (`applications/deployments/preview-deployments.mdx`).
- **Closing a PR deletes its preview's containers, not its database.** Data a preview wrote to an external service stays, so each preview's `pragmatic_papers_pr_<n>` copy of staging outlives the PR; later preview builds drop it (see [Dropping closed PRs' preview databases](#dropping-closed-prs-preview-databases)).
- **Build secrets need BuildKit.** With **Use Docker Build Secrets** on, Coolify mounts build-time variables as secrets; without BuildKit it silently falls back to build arguments, which can show in the image's metadata (`applications/configuration/environment-variables.mdx`). Each variable also has independent **Build Variable** / **Runtime Variable** toggles; turn **Build Variable** off for secrets the build doesn't read.
- **Old images are kept for rollback**, a configured number per app, and Docker cleanup skips them unless **Disable Application Image Retention** is on. A rollback runs an old image with the _current_ variables (`applications/deployments/rollbacks.mdx`, `core/infrastructure/servers/automated-docker-cleanup.mdx`).
- **Deployment logs can't be cleared.** The docs describe no way to delete a deployment's log, so anything a build prints stays readable to whoever can open the app in Coolify (#1066).

## 🧱 Build Cache and Environment Variables

Coolify passes every build-time variable into the Dockerfile as a BuildKit secret, mounted as an env var into **every** `RUN` (`--mount=type=secret,id=X,env=X`). That includes `SOURCE_COMMIT` when **Include Source Commit in Build** is on. What that means for the layer cache (verified 2026-09-26):

- **Variable _names_ are part of each step's cache key; _values_ are not.** Adding or removing a variable in an application gives its next build a cold cache. Changing a value doesn't invalidate anything: a step can be reused with output built from the old value.
- **So every step whose output depends on a value must come after `COPY . .`**, which reruns on every deploy. That covers migrations (`DATABASE_URI`) and `next build` (`NEXT_PUBLIC_*`, `SENTRY_RELEASE`). Only value-independent steps belong above it: system packages and the dependency install.
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

Code should treat a blank value the same as an unset one, since a variable can exist with no value. The shell checks above do. In TypeScript, prefer `process.env.X || fallback` over `process.env.X ?? fallback` wherever blank should fall back: `??` keeps `""`.

## 🔍 Common Issues

**Build failures:**

- Ensure all required environment variables are set in Coolify
- Required: `PAYLOAD_SECRET`, `NEXT_PUBLIC_SERVER_URL`, and `DATABASE_URI`
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

Coolify only comments on the PR; it doesn't create GitHub Deployments ([coollabsio/coolify#9583](https://github.com/coollabsio/coolify/issues/9583)). `.github/workflows/preview-deployment.yml` fills the gap: on each push to a PR it waits for Coolify to queue the preview build for that commit, then creates a Deployment for the PR's branch in the **Preview** environment and copies Coolify's status onto it. The PR then shows the build as queued, in progress, failed or live, with **View deployment** linking to `pr-<n>.pragmaticpapers.com`. There's deliberately no log link to the build in Coolify: Deployments are public on this repo, and it would publish the Coolify dashboard's address. Older previews of the PR go inactive when a newer one goes live, and all of them when the PR closes.

Set these under **Settings → Secrets and variables → Actions**:

| Name                       | Kind     | Value                                                                                                                |
| -------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------- |
| `COOLIFY_API_TOKEN`        | secret   | A Coolify API token with `read` access (**Keys & Tokens → API tokens**; enable the API under **Settings**)           |
| `COOLIFY_DASHBOARD_URL`    | variable | The Coolify server's URL, e.g. `https://coolify.example.com` (with or without `/api/v1`)                             |
| `COOLIFY_PREVIEW_APP_UUID` | variable | The UUID of the application that builds previews (the last segment of its dashboard URL)                             |
| `PREVIEW_URL_TEMPLATE`     | variable | Optional. The app's preview URL template in Coolify's syntax; defaults to `https://pr-{{pr_id}}.pragmaticpapers.com` |

Until all three required values are set, the workflow does nothing. It also skips the PRs Coolify doesn't preview while **public PR deployments** are off in Coolify: PRs from forks, PRs whose author isn't an owner, member or collaborator of the repo (Dependabot's included), and PRs titled `[skip ci]` or `[skip cd]`. If you turn public PR deployments on, widen the job's `if` to match. Any other PR Coolify doesn't build gets no Deployment; the job gives up after waiting 10 minutes. If the build runs longer than 45 minutes, the Deployment is marked as errored.

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

1. `modify-database-uri.sh` names the preview database `pragmatic_papers_pr_330` and writes only that name to `/tmp/database_name`. A preview build without `COOLIFY_FQDN` fails instead of falling back to the database every preview shares ([#1058](https://github.com/digitalgroundgame/pragmatic-papers/issues/1058)).
2. `copy-database.sh` creates it as a copy of `pragmatic_papers`, on the same server and with `DATABASE_URI`'s credentials. It tries `CREATE DATABASE … WITH TEMPLATE` first, which only works while nothing is connected to the source; with staging's app running it falls back to `pg_dump`/`pg_restore`. It never disconnects the source's clients: doing so failed whatever staging was serving ([#1057](https://github.com/digitalgroundgame/pragmatic-papers/issues/1057)). If the dump or restore fails, the half-restored database is dropped, so the next build copies again.
3. It leaves an existing preview database alone unless `FORCE_DATABASE_COPY=true`. Then the previous deploy's container is still using it, so the script copies into `pragmatic_papers_pr_330_incoming`, migrates that, and only then drops the old database and renames the copy into place. The running preview is never left on a missing or unmigrated database ([#1058](https://github.com/digitalgroundgame/pragmatic-papers/issues/1058)); if the migration fails, the build fails and the old database is kept.
4. Migrations and `next build` run against the preview database.
5. The runner image carries `/app/database_name`, and `start.sh` applies it to the runtime `DATABASE_URI`. No credential is written into the image.

**Requirements:**

- `DATABASE_URI` must be available at build time _and_ runtime, with the same value, in **every** environment: the image carries no credentials, so the running app reads only the runtime value, and `start.sh` exits if it's missing.
- Its user needs `CREATEDB`, read access to the source database (for `pg_dump`), and permission to terminate sessions on **preview** databases (for a forced recopy). It never terminates sessions on the source.
- **The builder's `pg_dump` must match the server's major version.** With staging's app connected, dump/restore is the usual path for a new preview, not the exception. An older `pg_dump` refuses a newer server, and a newer one writes settings an older server's restore rejects. The builder stage's `apk add` pins `postgresql17-client` to match the server; Alpine's unpinned `postgresql-client` follows the Alpine release under the Node image and had moved on to 18, which failed preview builds whose template copy was refused. `copy-database.sh` compares the two before creating anything, prints `pg_dump major version: N; server: M` in the build log, and fails the build with the package to install when they differ. **Upgrading the database server means bumping that pin in the same change.**
- **A dump holds `ACCESS SHARE` locks on staging's tables while it runs.** If a staging deploy runs `payload migrate` at the same time, an `ALTER TABLE` waits for them, and staging's queries queue behind that `ALTER`. While the database is small this lasts seconds; if staging ever hangs during a deploy, check whether a preview build was copying at the time.

**Running commands inside a preview container:** only `start.sh` points `DATABASE_URI` at the preview's own database. A shell opened with `docker exec` or Coolify's terminal still has the unsuffixed `DATABASE_URI`, which is **staging's** database. Apply the preview name first:

```sh
. /app/database-uri.sh && use_preview_database /app/database_name
```

**For Staging/Production:**
Set `BUILD_ENV=staging` or `BUILD_ENV=production` and leave `COPY_SOURCE_DATABASE` unset: the naming and the copy are both skipped, using your `DATABASE_URI` exactly as configured.

### Dropping closed PRs' preview databases

Coolify deletes a closed PR's preview containers but not its database, so every preview's copy of staging used to stay on the database server. Each preview build now cleans up after copying: `dockerfiles/scripts/drop-closed-preview-databases.ts` asks GitHub which PRs are open and drops `pragmatic_papers_pr_<n>` and `pragmatic_papers_pr_<n>_incoming` for every PR that isn't open. It logs each database it drops, by name.

- **It touches nothing else.** A name must be exactly the source database plus `_pr_<number>`, optionally followed by `_incoming`.
- **It skips when unsure.** If GitHub can't be reached, or its open list doesn't include the PR being built (the wrong repository, say), it drops nothing.
- **It keeps anything that might be live.** GitHub's list can miss an open PR, one too new to be listed yet or one that moved between pages while they were read. So a database is kept while anything is connected to it (a live preview's app always is), and when its PR is newer than every PR listed. It never disconnects anyone; a later build retries.
- **It never fails the build.** Any error is logged as `Skipping cleanup: …` and the build carries on.
- **Previews only.** Staging and production builds skip it (`COPY_SOURCE_DATABASE` isn't `true` there).
- **A reopened PR** gets a fresh copy on its next build, like a new one.
- **Credentials:** it reads open PRs from GitHub's public API without a token, which works while the repository is public (60 requests an hour per server, one or two per build). For a private repository, add a `GITHUB_TOKEN` build variable to the development application's preview variables: a fine-grained token with read access to pull requests. `GITHUB_REPOSITORY` overrides `digitalgroundgame/pragmatic-papers`.

### Pruning the image registry

Coolify pushes every build's image to the `docker-registry` resource (a `registry:2` service in the Pragmatic Papers project's **development** environment, running on dev-worker as `registry-<uuid>`), tagged `pr-<n>-<sha>` for a preview. A registry never deletes anything by itself, so by September 2026 it held 224 tags and 6.5 GB, the largest single use of dev-worker's 38 GB disk after the swap file. `dockerfiles/scripts/prune-registry.sh` trims it. It runs on dev-worker from root's crontab, not in a build or as a Coolify scheduled task: it has to stop the registry's container, which a task running inside that container can't do.

```sh
# once, as root on dev-worker
curl -fsSL https://raw.githubusercontent.com/digitalgroundgame/pragmatic-papers/dev/dockerfiles/scripts/prune-registry.sh -o /root/prune-registry.sh
chmod +x /root/prune-registry.sh
/root/prune-registry.sh            # dry run: lists what it keeps and how many it would delete
(crontab -l 2>/dev/null; echo '30 4 * * * /root/prune-registry.sh --apply >> /var/log/prune-registry.log 2>&1') | crontab -
```

- **What it keeps:** every tag a container on the server runs, the newest 2 tags of each open PR (`KEEP_PER_PR`), every tag of a PR newer than all the open ones GitHub listed (it may be too new to be listed), and the newest 10 tags that aren't a PR's (`KEEP_OTHER`), for rollbacks and for production if it runs them. Everything else goes, including every tag of a closed PR.
- **How:** it deletes the tags' directories in the registry's storage, then runs `registry garbage-collect --delete-untagged` in a throwaway container sharing the registry's volumes. The registry is **stopped** meanwhile, so a push can't land half-collected; a deploy that pushes in that minute fails and needs redeploying, hence 04:30.
- **It deletes nothing when unsure:** if GitHub can't be reached, lists no open PRs, or fails partway through its pages, it exits 1 before touching the registry. It finds the registry as the only `registry-*` container and its storage as the mount at `/var/lib/registry`; set `REGISTRY_CONTAINER` if there are several.
- **Private repository:** set `GITHUB_TOKEN` in the crontab line, a fine-grained token with read access to pull requests.

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

- Configure persistent volume mount in Coolify for `/app/apps/pragmatic-papers/public/media/`
- Regular backups of the media volume recommended

### S3 Storage (Production)

```env
USE_LOCAL_STORAGE=false
S3_REGION=us-east-1
S3_BUCKET=your-bucket
S3_ACCESS_KEY_ID=your-key
S3_SECRET_ACCESS_KEY=your-secret
S3_ENDPOINT=https://s3.amazonaws.com
```

**Benefits:**

- Files stored in S3-compatible storage (AWS S3, Supabase Storage, Cloudflare R2, etc.)
- Better scalability and CDN integration
- Automatic redundancy and backups
- Recommended for production deployments

## 🆘 Need Help?

- Check environment variable examples: `.env.*.example`
- Review Coolify logs for build/runtime errors
- Verify health checks in Coolify dashboard. The image's `HEALTHCHECK` requests `/api/users/me` and passes once Payload has started against the database; a container stuck unhealthy usually means `start.sh` exited (check its log for `DATABASE_URI is not set at runtime`) or the database is unreachable
