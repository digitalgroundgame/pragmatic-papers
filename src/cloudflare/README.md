# The public site as a Cloudflare Worker

The public site can be built as a Cloudflare Worker with
[OpenNext](https://opennext.js.org/cloudflare). Payload's Local API reads the same
Postgres, and the admin panel, Payload's REST/GraphQL API, uploads, migrations and jobs
stay on Coolify. The point is client-side navigation: Next adds an `_rsc` value to each
navigation request that changes with the page it came from, so Cloudflare's zone cache
stores every variation separately and almost every click misses. OpenNext keys its cache
by route, so navigations from any page read the same entry. It needs Workers Paid: the
Worker is ~8.3 MiB gzipped against a 10 MiB limit (3 MiB on Free). Open issue #916
tracks turning `next/link` back on.

Nothing here changes the Coolify build: everything Worker-specific is behind
`OPENNEXT_BUILD=true`, which only `pnpm build:worker` sets.

Today it runs as **staging's Worker**, `pragmatic-papers-staging` on workers.dev, reading
staging's database through Hyperdrive, while staging itself keeps running on Coolify.
`.github/workflows/worker.yml` deploys it on every push to `dev`.

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
4. **Repo secret** `STAGING_PAYLOAD_SECRET` (staging's `PAYLOAD_SECRET`), and **variables**
   `WORKER_STAGING_URL` (the Worker's workers.dev URL) and `SHOWCASE_STAGING_URL`
   (staging's Coolify URL, which the Worker sends `/admin` and `/api` to).
5. **Coolify staging**: the runtime variable `WORKER_URL` (the Worker's workers.dev URL).
   With it, every save that purges Cloudflare's edge clears the Worker's cache first,
   through `/next/revalidate-all` with staging's `PAYLOAD_SECRET`
   (`src/hooks/purgeEdgeCache.ts`). Without it, an edit to an article or volume shows on
   the Worker when its `revalidate` time (an hour) passes or the next deploy.

Until all of them are set, the workflow skips itself.

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
3. `opennextjs-cloudflare deploy` uploads the prerendered pages to R2, creates D1's table,
   and runs `wrangler deploy` with `SERVER_URL`, `ORIGIN_URL` and `PAYLOAD_SECRET`.
4. `POST /next/revalidate-all` throws away the build's pages (it built from an empty
   database), so each renders from staging's data on its next request.

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

| Piece                                 | Why                                                                                                                                                                                                                            |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `scripts/build-worker.mjs`            | Builds with webpack (Turbopack copies the Payload config into every route group: 2.4×, ~20 MiB) and without `src/app/(payload)`, which it moves aside and puts back                                                            |
| `withCloudflare.ts`                   | The Next config for the Worker: stubs, `pg` handling and traces, applied by `next.config.ts` when `OPENNEXT_BUILD=true`. Unit-tested in `__tests__/`                                                                           |
| `worker.mjs`, `origin.ts`             | The Worker's entry: OpenNext's handler, behind one that sends `/admin`, `/api` and the admin's `/_next/static` files to `ORIGIN_URL`, reads media for next/image from there too, and points Payload at Hyperdrive. Unit-tested |
| `open-next.config.ts`                 | OpenNext's caches: pages in R2 keyed by route, a Durable Object queue that re-renders pages past their `revalidate` time, and D1 for `revalidatePath` / `revalidateTag`                                                        |
| `stubs/unavailable.ts`                | Stands in for `drizzle-kit/api`, `sharp` and `@google-analytics/data` (~17 MB with its gRPC stack), which only Coolify's code paths call. Calling one in the Worker throws                                                     |
| `sharp.ts`                            | Payload's `sharp`, imported from here because Next keeps `sharp` external however it's aliased; the Worker build swaps this module instead                                                                                     |
| `pg` external, `pg-cloudflare` traced | Bundled by webpack, `pg` would get `pg-cloudflare`'s empty Node build. Left external, OpenNext's esbuild bundles it with the `workerd` condition                                                                               |
| `maxUses: 1` in `payload.config.ts`   | A Worker can't reuse a socket opened during another request; without it every request after the first hangs. Applies only when running in a Worker                                                                             |

## Measured

- **Size** (`wrangler deploy --dry-run`): 35.5 MB raw, 8.29 MiB gzipped. With
  Turbopack it was 17.4–24.4 MiB; with webpack but keeping `(payload)`, 10.5 MiB. If it
  needs to shrink, the next cuts are the newsletter's email stack (react-email,
  Tailwind, `css-tree`: ~3.9 MB raw), the seed endpoint and `prompts`, and the
  `email-preview` and `next/seed` routes.
- **Cache** (`wrangler dev`, seeded Postgres): articles and volumes, which prerender
  with `revalidate = 3600`, come from R2 in 20–40 ms, for full pages and navigations
  alike, and a navigation with a different `_rsc` value reads the same entry. `/` and
  the other dynamic pages render each time (90–280 ms warm); a cold isolate's first
  request pays Payload's init (~1.4 s locally).
- **Today, through Cloudflare's zone cache**: a navigation that misses waits ~500 ms on
  Coolify; a full page from Cloudflare's cache ~65 ms.

## Before it can serve production

- **Real latency and cold-start CPU**, measured on the staging Worker.
- **A custom domain**, and the zone's cache rules for it (`cloudflare/rulesets/`).
- **Skew protection** (`skewProtection` in `open-next.config.ts`, experimental): sends a
  tab opened before a deploy to the version that built its page, which also avoids
  Next's "router state header could not be parsed" error on stale tabs.
- **Production**: a second Worker (a wrangler environment) on production's database.
