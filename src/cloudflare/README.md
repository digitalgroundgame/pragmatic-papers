# The public site as a Cloudflare Worker

The public site can be built as a Cloudflare Worker with
[OpenNext](https://opennext.js.org/cloudflare). Payload's Local API reads the same
Postgres, and the admin panel, Payload's REST/GraphQL API, uploads, migrations and jobs
stay on Coolify. The point is client-side navigation: Next adds an `_rsc` value to each
navigation request that changes with the page it came from, so Cloudflare's zone cache
stores every variation separately and almost every click misses. OpenNext keys its cache
by route, so navigations from any page read the same entry. It needs Workers Paid: the
Worker is ~4.9 MiB gzipped against a 10 MiB limit (3 MiB on Free). Open issue #916
tracks turning `next/link` back on.

Nothing here changes the Coolify build: everything Worker-specific is behind
`OPENNEXT_BUILD=true`, which only `pnpm build:worker` sets.

Today it runs as **staging's Worker**, `pragmatic-papers-staging` at
`staging-worker.pragmaticpapers.com` (a Custom Domain) and on workers.dev, reading
staging's database through Hyperdrive, while staging itself keeps running on Coolify.
`.github/workflows/worker.yml` deploys it on every push to `dev`, and production's,
`pragmatic-papers-production` (`env.production` in `wrangler.jsonc`), on every push to
`main` once [its setup](#production) is done. Production's stays on workers.dev until
`pragmaticpapers.com` is moved onto it.

## Cloudflare setup (once)

`wrangler.jsonc` declares the Worker and everything it binds. The deploy workflow creates
the R2 bucket and D1 database by name if they're missing. The rest is set up by hand:

0. **TLS on staging's Postgres**, which Hyperdrive requires: in Coolify, stop the
   database, turn on **SSL** (mode `require`) on its General page, and start it again.
1. **Tunnel to staging's Postgres**: in Zero Trust, Networks → Tunnels, create a tunnel
   and run its `cloudflared` connector on dev-worker (a Coolify service on the same
   network as staging's Postgres). Coolify's Cloudflared template runs it on the host
   network, where container names don't resolve (`lookup <id>: server misbehaving`):
   delete `network_mode: host` from its compose and turn on **Connect to Predefined
   Network**. Give the tunnel a public hostname with service type TCP, pointing at the
   Postgres container's port 5432 (the host in Coolify's internal Postgres URL).
   Postgres gets no public port.
2. **Hyperdrive**: create a config with "Connect to private database", using the tunnel's
   hostname and the user, password and database from staging's `DATABASE_URI` (the
   database is `pragmatic_papers`, with an underscore; the same server also has an empty
   `pragmatic-papers`). Cloudflare creates the Access application and service token. Its
   ID is in `wrangler.jsonc`.
3. **API token** with Workers Scripts, Workers R2 Storage, D1 and Hyperdrive, all Edit:
   the repo secret `CLOUDFLARE_WORKERS_TOKEN`. `CLOUDFLARE_ACCOUNT_ID` is shared with the
   Storybook deploy.
4. **Custom Domain** `staging-worker.pragmaticpapers.com`: Workers & Pages →
   `pragmatic-papers-staging` → Settings → Domains & Routes → Add → Custom Domain, enabled
   for Production. Cloudflare creates its DNS record and certificate. It isn't in
   `wrangler.jsonc`, which would need the deploy token to have zone permissions.
5. **Repo secret** `STAGING_PAYLOAD_SECRET` (staging's `PAYLOAD_SECRET`), and **variables**
   `WORKER_STAGING_URL` (`https://staging-worker.pragmaticpapers.com`) and
   `SHOWCASE_STAGING_URL` (staging's Coolify URL, which the Worker sends `/admin` and
   `/api` to; the deploy passes it as `ORIGIN_URL`).
6. **Coolify staging**: the runtime variable `WORKER_URL` (the same URL).
   With it, every save that purges Cloudflare's edge clears the Worker's cache first,
   through `/next/revalidate-all` with staging's `PAYLOAD_SECRET`
   (`src/hooks/purgeEdgeCache.ts`). Without it, an edit to an article or volume shows on
   the Worker when its `revalidate` time (an hour) passes or the next deploy.

7. **Sentry**: the repo secret `SENTRY_DSN`, the DSN Coolify's apps have. The deploy gives
   it to the Worker as a secret, with `BUILD_ENV` and the commit as `SENTRY_RELEASE`;
   without it the Worker reports nothing.

Until all of them are set, the workflow skips itself.

### Production

The same steps, for production's database and hostname:

1. **Hyperdrive** on production's Supabase database, as a public database (no tunnel:
   Supabase is public), with Supabase's Direct connection string
   (`db.<project-ref>.supabase.co:5432`), not a `pooler.supabase.com` one: Cloudflare's
   Supabase guide for Hyperdrive says so, since Hyperdrive pools connections itself. It's
   `pragmatic-papers-production`, in `env.production` in `wrangler.jsonc`. Direct
   connections don't count against the pooler's pool size but against the database's own
   limit (Micro: 60, of which the pooler may hold 40), and a new config's limit is 60
   already. So set its **Maximum connections** (the config's Settings, Origin connection
   limit) to 10, and lower it if the pooler's size is raised. Staging's is 10 too.
2. **Repo secret** `PRODUCTION_PAYLOAD_SECRET` (production's `PAYLOAD_SECRET`) and
   **variables** `PRODUCTION_ORIGIN_URL` (production's Coolify URL),
   `WORKER_PRODUCTION_URL` (the Worker's URL: its workers.dev address until it takes over),
   and `PRODUCTION_SUPABASE_URL` and `PRODUCTION_S3_BUCKET` (production's `SUPABASE_URL` and
   `S3_BUCKET`, which media links are built from; the Worker never uploads, so it has no S3
   credentials).
3. **Coolify production**: `WORKER_URL`, as for staging.
4. **Taking over the hostname**, once it has served from workers.dev for a while:
   - give Coolify's production app a hostname of its own (e.g.
     `origin.pragmaticpapers.com`) beside `pragmaticpapers.com`, and set
     `PRODUCTION_ORIGIN_URL` to it. The Worker sends the admin panel, the API and Coolify's
     own `/next/` routes there (`ORIGIN_ROUTES` in `origin.ts`), so `start.sh`'s
     `/next/purge-edge` and the deploy records' `/next/version` still reach Coolify;
   - add `pragmaticpapers.com` (and `www`) as Custom Domains on
     `pragmatic-papers-production`, which replaces their DNS records, and set
     `WORKER_PRODUCTION_URL` to `https://pragmaticpapers.com`;
   - the zone's Cache Rules (`cloudflare/rulesets/`) no longer apply to the site's pages,
     which Workers Cache holds instead (`edgeCache.ts`). Moving the Custom Domain back to
     Coolify's DNS record undoes it.

## Each deploy

1. Builds against a throwaway, migrated Postgres (`pnpm build:worker`), so nothing reaches
   staging's database while building.
2. Waits until staging's Coolify app reports, at `/next/migrations`, that its database has
   run the newest migration in the commit. Coolify migrates while it builds the same push,
   so this keeps the new Worker off the old schema. A push without a migration passes at
   once. The other way round stays open: while Coolify migrates, the Worker still serving
   the previous commit meets the new schema, as Coolify's own old container does. A
   migration that drops or renames a column breaks both for that window, so split it:
   add the new column in one release and drop the old one in the next.
3. Deploys the queue Worker (`queue.wrangler.jsonc`) from the same build, since the site
   binds to its class.
4. `opennextjs-cloudflare deploy` uploads the prerendered pages to R2, creates D1's table,
   maps each earlier deploy's ID to its Worker version for skew protection
   (`CF_DEPLOYMENT_MAPPING`, read from the last version), and runs `wrangler deploy` with
   `SERVER_URL`, `ORIGIN_URL`, `SENTRY_RELEASE` and the secrets (`PAYLOAD_SECRET`,
   `SENTRY_DSN`).
5. `POST /next/revalidate-all` throws away the build's pages (it built from an empty
   database), so each renders from staging's data on its next request.
6. `POST /next/warm-worker` on staging requests the most-read pages through the Worker's
   URL, so the first readers find them cached. Staging, not the Worker, warms it: it can
   look up the newest volume, and it does the same after every save that clears the
   Worker's cache.

## Build and run it locally

```sh
# A database with the schema, seeded (e.g. pnpm dev:db-seed). The Worker reaches it as
# its Hyperdrive binding, so wrangler needs it under this name too.
export DATABASE_URI=… CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE=…
PAYLOAD_SECRET=… SERVER_URL=http://localhost:8787 USE_LOCAL_STORAGE=true pnpm build:worker
pnpm exec opennextjs-cloudflare populateCache local   # the build's pages into local R2, and D1's table
pnpm start:worker --var PAYLOAD_SECRET:… --var SERVER_URL:http://localhost:8787 --var ORIGIN_URL:<a Coolify URL>
pnpm exec wrangler deploy --dry-run --outdir .wrangler/dry-run   # gzipped size; uploads nothing
```

The build takes several minutes and prerenders against the database, like `pnpm build`.
`wrangler dev` simulates R2, D1 and Durable Objects locally. Without `ORIGIN_URL`,
`/admin`, `/api` and media 404.
`scripts/bench-cache.sh <origin> <path>` times full pages and navigations against any
deployment.

## How it works

| Piece                                  | Why                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scripts/build-worker.mjs`             | Builds with webpack (Turbopack copies the Payload config into every route group: 2.4×, ~20 MiB) and without `src/app/(payload)`, which it moves aside and puts back                                                                                                                                                                                                                                                                                                    |
| `withCloudflare.ts`                    | The Next config for the Worker: stubs, `pg` handling and traces, applied by `next.config.ts` when `OPENNEXT_BUILD=true`. Unit-tested in `__tests__/`                                                                                                                                                                                                                                                                                                                   |
| `worker.mjs`, `origin.ts`              | The Worker's entry: OpenNext's handler, behind one that sends `/admin`, `/api` and the admin's `/_next/static` files to `ORIGIN_URL`, reads media for next/image from there too, and points Payload at Hyperdrive. Unit-tested                                                                                                                                                                                                                                         |
| `open-next.config.ts`                  | OpenNext's caches: pages in R2 keyed by route, a Durable Object queue that re-renders pages past their `revalidate` time, and D1 for `revalidatePath` / `revalidateTag`                                                                                                                                                                                                                                                                                                |
| `stubs/unavailable.ts`                 | Stands in for `drizzle-kit/api`, `sharp` and `@google-analytics/data` (~17 MB with its gRPC stack), which only Coolify's code paths call. Calling one in the Worker throws                                                                                                                                                                                                                                                                                             |
| `stubs/sentry.ts`                      | Stands in for `@sentry/nextjs` in the server code. The Worker has no `SENTRY_DSN`, so it reported nothing, and its Node SDK and OpenTelemetry were ~1.8 MiB gzipped of what every new isolate loads. The browser's SDK is kept                                                                                                                                                                                                                                         |
| `_headers`                             | Copied into `.open-next/assets` by the build: hashed `/_next/static` files are cached for a year, where Workers Static Assets would send `max-age=0, must-revalidate`                                                                                                                                                                                                                                                                                                  |
| `edgeCache.ts`, `CachedSite`           | Workers Cache, on the `CachedSite` entrypoint (`exports` in `wrangler.jsonc`). The default entrypoint is a gateway that sends it anonymous full pages and images only: logins, drafts, `Authorization`, Server Actions, OpenNext's revalidations and navigations (RSC) skip it. Only a 2xx or 3xx with caching headers is kept, tagged with its path (and `shared` for listings); `/next/revalidate-all` purges the paths it names (`?path=`, `?shared`), or all of it |
| `queue.mjs`, `queue.wrangler.jsonc`    | A Worker of its own (`pragmatic-papers-<env>-queue`) holding OpenNext's revalidation queue, a Durable Object the site binds to by `script_name`, so the site implements none and keeps the Version URLs skew protection sends earlier deploys' tabs to. It requests pages from the site to re-render them, and is deployed from the same build, before the site                                                                                                        |
| `gateway.ts`, `gateway.wrangler.jsonc` | A Worker of its own (`pragmatic-papers-<env>-gateway`, about 3 KB) that makes the same choice in front of the site, over service bindings to its two entrypoints, so a page the edge cache holds is answered without a new isolate loading the site's 22 MB. It serves the site's assets too, and adds a `gateway` entry to `Server-Timing` that says whether its isolate was cold. Deployed after the site; the hostnames move onto it once it's measured             |
| `withImageCaching` in `origin.ts`      | Gives `/_next/image` responses the `Cache-Control` Next's optimizer sends on Coolify. OpenNext sets one only on images it can call immutable, which Payload's media never are                                                                                                                                                                                                                                                                                          |
| `sharp.ts`                             | Payload's `sharp`, imported from here because Next keeps `sharp` external however it's aliased; the Worker build swaps this module instead                                                                                                                                                                                                                                                                                                                             |
| `pg` external, `pg-cloudflare` traced  | Bundled by webpack, `pg` would get `pg-cloudflare`'s empty Node build. Left external, OpenNext's esbuild bundles it with the `workerd` condition                                                                                                                                                                                                                                                                                                                       |
| `maxUses: 1` in `payload.config.ts`    | A Worker can't reuse a socket opened during another request; without it every request after the first hangs. Applies only when running in a Worker                                                                                                                                                                                                                                                                                                                     |

## Measured

- **Size** (`wrangler deploy --dry-run`): 22.4 MB raw, 4.88 MiB gzipped, of which
  `@sentry/cloudflare` is ~0.45 MiB (4.43 MiB without it). Stubbing the
  server's Sentry SDK took it from 8.38 to 6.61 MiB, and passing the feed's server action
  down from its pages to 4.43 MiB: imported by a client component, an action is compiled
  in a layer of its own, with a second copy of everything it reaches, Payload's config
  included. Keep server actions out of client imports. With Turbopack it was 17.4–24.4
  MiB; with webpack but keeping `(payload)`, 10.5 MiB. If it needs to shrink, the next
  cuts are the newsletter's email stack (react-email, Tailwind, `css-tree`: ~3.9 MB raw),
  the seed endpoint and `prompts`, and the `email-preview` and `next/seed` routes.
- **Cold isolate** (`wrangler dev`): the first request that reaches Next's server takes
  ~1.5 s (2.1 s before the two cuts above), mostly compiling webpack's runtime and
  Payload's chunk. Later requests take 70–100 ms. Pages already in R2 skip it: OpenNext's
  cache interceptor answers them before Next loads.
- **Cache** (`wrangler dev`, seeded Postgres): articles and volumes, which prerender
  with `revalidate = 3600`, come from R2 in 20–40 ms, for full pages and navigations
  alike, and a navigation with a different `_rsc` value reads the same entry. `/` and
  the other dynamic pages render each time (90–280 ms warm); a cold isolate's first
  request pays Payload's init (~1.4 s locally).
- **Today, through Cloudflare's zone cache**: a navigation that misses waits ~500 ms on
  Coolify; a full page from Cloudflare's cache ~65 ms.

## Before it can serve production

In the repo now:

- **Error reporting**: both entrypoints run inside `@sentry/cloudflare`'s `withSentry`
  (`sentry.ts`), errors only, tagged `runtime: worker`. The server code's
  `@sentry/nextjs` calls (`onRequestError`, Payload's plugin, `sentrySdk.ts`) reach it
  through `stubs/sentry.ts`, and the browser SDK reads its DSN from the page as on
  Coolify.
- **Production's Worker** and its deploy, and Coolify's `/next/` routes passed through.

Still open:

- **Cold isolates.** On staging-worker (2026-10-16), pages whose `revalidate` time had
  passed waited 2.9–4.2 s, and 1 in 20 cache hits took 1.3–1.8 s instead of ~95 ms.
  Coolify behind the zone cache answers its hits in ~65 ms, and its worst ~0.8 s. A cold
  miss spends about half its CPU loading the app's modules, the root layout reaching the
  whole Payload config, with no single module above ~100 ms, so the lever there is fewer
  misses. A hit never runs Next, so a slow one is either a new isolate loading the 22 MB
  script or the upper cache tier; the gateway Worker takes the first away, and its
  `Server-Timing` tells the two apart. Until its measurements are in, the hostnames stay on
  the site's Worker.
- **Skew protection** (`skewProtection` in `open-next.config.ts`, experimental) sends a
  request from a page an earlier deploy built (Next's `deploymentId`, set per run in
  `NEXT_DEPLOYMENT_ID`) to that deploy's Version URL, which also avoids Next's "router
  state header could not be parsed" error on stale tabs. Cloudflare generates no Version
  URLs for a Worker that implements a Durable Object, so the revalidation queue is in the
  queue Worker. It acts only on custom hostnames (staging-worker, and production's once it
  has one), not on workers.dev. Next adds `dpl` to `/_next/image` URLs of local images, so
  those are optimized again after each deploy.
- **The setup above** for production, then a stretch on workers.dev reading production's
  data before the hostname moves.
- **Navigations from the edge cache.** The zone's Cache Rules don't apply to a Worker,
  so its edge cache is [Workers Cache](https://developers.cloudflare.com/workers/cache/)
  (`edgeCache.ts`), which holds full pages and images but not navigations: Next varies
  those on the router's state and redirects when `_rsc` doesn't match it. They come from
  R2 (~130 ms), and dynamic pages' navigations render each time. With caching on, every
  request is billed as a Worker request, static files included, and a request the gateway
  hands to `CachedSite` counts twice.
