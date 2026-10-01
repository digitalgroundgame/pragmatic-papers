# Cloudflare Worker spike (#916)

Can the public site run as a Cloudflare Worker (OpenNext), with Payload's Local API
reading the same Postgres, while the admin panel stays on Coolify? This is step 1 of
the plan sketched on #916: the decision gate.

## How to run it

```sh
# Postgres with the schema (or a seeded database), then:
DATABASE_URI=… PAYLOAD_SECRET=… SERVER_URL=… USE_LOCAL_STORAGE=true node scripts/build-worker.mjs
pnpm exec wrangler deploy --dry-run --outdir /tmp/worker   # size, nothing uploaded
pnpm exec wrangler dev --var DATABASE_URI:… --var PAYLOAD_SECRET:… --var SERVER_URL:… --var USE_LOCAL_STORAGE:true
```

`scripts/build-worker.mjs` sets `OPENNEXT_BUILD=true`, which turns on everything
Worker-specific in `next.config.ts`; without it the app builds exactly as before.

## Results

### Size: fits, with webpack and without the admin panel

Cloudflare's limit is 10 MiB gzipped on the Workers Paid plan (3 MiB on Free).
`wrangler deploy --dry-run`:

| Build                                                      | Raw      | Gzipped    |
| ---------------------------------------------------------- | -------- | ---------- |
| Turbopack, everything                                      | 125.1 MB | 24.4 MB    |
| Turbopack, Google Analytics client stubbed                 | 93.3 MB  | 20.4 MB    |
| Turbopack, that and no `(payload)` route group             | 78.2 MB  | 17.4 MB    |
| Webpack, with `(payload)`                                  | 44.2 MB  | 10.5 MB    |
| **Webpack, no `(payload)` (what `build-worker.mjs` does)** | 35.1 MB  | **8.3 MB** |

- **Turbopack duplicates.** Every route loads the Payload config through the Local
  API, and Turbopack copies that module graph into each route group's chunks: 36.6 MB
  of mapped code is 15.1 MB of unique code (2.4×). Webpack shares the chunks.
- **The `updateRecommendations` job's `@google-analytics/data`** (with `google-gax`,
  `@grpc`, `protobufjs`, `google-auth-library`) was ~17 MB raw, because the job is in
  `payload.config.ts`. OpenNext bundles every server chunk, so a lazy `import()` wouldn't
  help; the Worker build stubs it. Jobs keep running on Coolify.
- Headroom is ~1.9 MiB. The next things to cut, if needed: the newsletter's email
  stack (react-email + Tailwind + `css-tree`, ~3.9 MB raw), the seed endpoint and
  `prompts`, and the `email-preview` and `next/seed` routes, which can stay on Coolify.

### Rendering: works, through the Local API, against Postgres

`wrangler dev` (workerd) against a seeded Postgres over TCP sockets:

| Request                                 | Result                                                                     |
| --------------------------------------- | -------------------------------------------------------------------------- |
| `/` (cold)                              | 200, 71.8 KB, 2.0 s                                                        |
| `/` (warm)                              | 200, 0.07 s                                                                |
| `/articles/<slug>` ×3                   | 200, 121 KB, 0.11–0.16 s                                                   |
| `/articles/<slug>` with `RSC: 1`        | 200 `text/x-component`, 68.7 KB, 0.13 s (after Next's own `_rsc` redirect) |
| `/topics`, `/authors`, `/feed.articles` | 200                                                                        |
| `/robots.txt`, `/sitemap.xml`           | 200 (prerendered)                                                          |

The cold request includes Payload's init (`getPayload`), so each new isolate pays ~2 s
locally before Hyperdrive's network round trips.

### What it took

All behind `OPENNEXT_BUILD=true` unless noted:

- **Stubs** (`src/cloudflare/stubs/unavailable.ts`) for what a Worker can't load and
  the public site never calls: `drizzle-kit/api` (migrations, schema push; withPayload
  leaves it out of Next's traces, so the Worker bundle can't resolve it), `sharp`
  (native) and `@google-analytics/data`.
- **`sharp` through `src/cloudflare/sharp.ts`** (always): Next keeps `sharp` external
  however it's aliased, so the Worker build swaps our module that imports it.
- **`pg` kept external**, so OpenNext's esbuild bundles it with the `workerd` condition:
  bundled by webpack, `pg-cloudflare` resolved to its empty Node build (`CloudflareSocket
is not a constructor`). `pg-cloudflare` is added to Next's traces for the same reason.
- **`maxUses: 1` on the pool when running in a Worker** (always; `payload.config.ts`):
  a Worker can't reuse a socket opened during another request. Without it, every
  request after the first hung until workerd cancelled it.

## Not tested yet

- **Hyperdrive** and real network latency: needs a deploy (a Cloudflare token with
  Workers, R2 and Hyperdrive access) and a Hyperdrive config for the database.
- **The R2 incremental cache and ISR**: pages are still `force-dynamic`, so nothing was
  cached; step 2 of the #916 plan.
- **CPU limits** on a cold start (Payload's init) in production.
- **Images** (the `IMAGES` binding) and media.
- **Routing** `/admin`, `/api`, `/media` and `/map-assets` to Coolify (a custom Worker
  entry), and revalidation from Coolify's hooks.
