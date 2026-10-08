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

## Build and run it locally

```sh
# A database with the schema, seeded (e.g. pnpm dev:db-seed), then:
DATABASE_URI=… PAYLOAD_SECRET=… SERVER_URL=http://localhost:8787 USE_LOCAL_STORAGE=true pnpm build:worker
pnpm start:worker --var DATABASE_URI:… --var PAYLOAD_SECRET:… --var SERVER_URL:http://localhost:8787 --var USE_LOCAL_STORAGE:true
pnpm exec wrangler deploy --dry-run --outdir .wrangler/dry-run   # gzipped size; uploads nothing
```

The build takes several minutes and prerenders against the database, like `pnpm build`.
`wrangler dev` simulates R2 locally, so `x-nextjs-cache: HIT` on a second request to an
article shows the cache working. `scripts/bench-cache.sh <origin> <path>` times full
pages and navigations against any deployment.

## How the build works

| Piece                                          | Why                                                                                                                                                                        |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scripts/build-worker.mjs`                     | Builds with webpack (Turbopack copies the Payload config into every route group: 2.4×, ~20 MiB) and without `src/app/(payload)`, which it moves aside and puts back        |
| `withCloudflare.ts`                            | The Next config for the Worker: stubs, `pg` handling and traces, applied by `next.config.ts` when `OPENNEXT_BUILD=true`. Unit-tested in `__tests__/`                       |
| `stubs/unavailable.ts`                         | Stands in for `drizzle-kit/api`, `sharp` and `@google-analytics/data` (~17 MB with its gRPC stack), which only Coolify's code paths call. Calling one in the Worker throws |
| `sharp.ts`                                     | Payload's `sharp`, imported from here because Next keeps `sharp` external however it's aliased; the Worker build swaps this module instead                                 |
| `pg` external, `pg-cloudflare` traced          | Bundled by webpack, `pg` would get `pg-cloudflare`'s empty Node build. Left external, OpenNext's esbuild bundles it with the `workerd` condition                           |
| `maxUses: 1` in `payload.config.ts`            | A Worker can't reuse a socket opened during another request; without it every request after the first hangs. Applies only when running in a Worker                         |
| `open-next.config.ts`, `wrangler.jsonc` (root) | OpenNext's R2 incremental cache, the `IMAGES` binding and the Worker's self-reference, from the package's templates                                                        |

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

## Before it can serve real traffic

- **Hyperdrive** for the database connection, and real latency and cold-start CPU,
  measured on a deployment.
- **Routing**: `/admin`, `/api`, `/media` and `/map-assets` to Coolify,
  everything else to the Worker.
- **Revalidation**: Coolify's `revalidate*` hooks have to clear the Worker's R2 cache
  too, not just Next's cache on Coolify and Cloudflare's edge.
- **Images** through the `IMAGES` binding, and media URLs.
- **Skew protection** (`skewProtection` in `open-next.config.ts`, experimental): sends a
  tab opened before a deploy to the version that built its page, which also avoids
  Next's "router state header could not be parsed" error on stale tabs.
- **Deploys**: a workflow that builds and uploads the Worker, with a Cloudflare token
  for Workers, R2 and Hyperdrive.
