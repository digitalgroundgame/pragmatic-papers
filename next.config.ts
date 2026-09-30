import { withSentryConfig } from "@sentry/nextjs/config"
import { withPayload } from "@payloadcms/next/withPayload"
import type { NextConfig } from "next"
import path from "path"
import { fileURLToPath } from "url"

import { prNumberFromFqdn } from "./src/utilities/prNumberFromFqdn"

const __filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(__filename)

const NEXT_PUBLIC_SERVER_URL = new URL(
  process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:8000",
)

const NEXT_PUBLIC_SUPABASE_URL = new URL(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://example.com",
)

const nextConfig: NextConfig = {
  output: "standalone",
  // Inlined into every bundle (client, server, edge) for the Sentry configs to share; only
  // the build sees BUILD_ENV and COOLIFY_FQDN. Sentry's environment is the deploy
  // (production, staging, preview), and a preview is tagged with its PR.
  env: {
    SENTRY_ENVIRONMENT: process.env.BUILD_ENV || "development",
    SENTRY_PR:
      process.env.BUILD_ENV === "preview" ? prNumberFromFqdn(process.env.COOLIFY_FQDN) : "",
  },
  // Temporarily required on Windows until Next.js fixes Turbopack Sass resolution.
  // See: https://github.com/vercel/next.js/issues/86431
  sassOptions: {
    loadPaths: ["./node_modules/@payloadcms/ui/dist/scss/"],
  },
  images: {
    qualities: [80],
    remotePatterns: [
      {
        protocol: NEXT_PUBLIC_SERVER_URL.protocol.slice(0, -1) as "http" | "https",
        hostname: NEXT_PUBLIC_SERVER_URL.hostname,
        port: NEXT_PUBLIC_SERVER_URL.port,
      },
      {
        protocol: NEXT_PUBLIC_SUPABASE_URL.protocol.slice(0, -1) as "http" | "https",
        hostname: NEXT_PUBLIC_SUPABASE_URL.hostname,
        port: NEXT_PUBLIC_SUPABASE_URL.port,
      },
      {
        // Merch products are synced from Shopify and render straight from its
        // CDN — we don't copy product shots into Media.
        protocol: "https",
        hostname: "cdn.shopify.com",
      },
    ],
  },
  reactStrictMode: true,
  experimental: {
    serverActions: {
      // Payload's admin panel drives its document forms through a Server Action (this
      // repo's own `serverFunction` in `src/app/(payload)/layout.tsx`), and an interactive
      // snapshot carries the researcher's feed as one JSON field on that form — 1.3 MB for
      // the federal judiciary today, and it only grows. Next's default limit is 1 MB, so
      // unpublishing a snapshot failed with "Body exceeded 1 MB limit". The field never
      // needs to be in that form at all (issue #905), but the limit is what stands between
      // an editor and a broken publish button today.
      //
      // There is no per-action override for this in Next — `bodySizeLimit` is one number
      // for every Server Action in the app, so this also covers `getAuth.ts` and
      // `SocialEmbed/hooks/revalidateSnapshot.ts`. Neither is publicly reachable, so the
      // practical exposure is low; it is still wider than the one flow this was raised for.
      bodySizeLimit: "8mb",
    },
  },
  // Interactive Map drilldown assets are fetched lazily from stable, same-origin paths that
  // are emitted into the article HTML (so a crawler can capture them). With local storage the
  // files sit in public/map-assets and Next serves them directly; with S3 enabled this proxies
  // the same path to the bucket, so the URL never changes between environments.
  async rewrites() {
    if (process.env.USE_LOCAL_STORAGE === "true") return []
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const bucket = process.env.S3_BUCKET
    if (!supabaseUrl || !bucket) return []
    return {
      afterFiles: [
        {
          source: "/map-assets/:path*",
          destination: `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/${bucket}/map-assets/:path*`,
        },
      ],
    }
  },
  redirects: async () => [
    {
      destination: "/ie-incompatible.html",
      has: [
        {
          type: "header",
          key: "user-agent",
          value: "(.*Trident.*)", // all ie browsers
        },
      ],
      permanent: false,
      source: "/:path((?!ie-incompatible.html$).*)", // all pages except the incompatibility page
    },
    {
      source: "/iceout/:state*",
      destination: "https://iceout.org/en/location/report",
      permanent: false,
    },
  ],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
      {
        // Payload admin panel: never cache — always requires a fresh authenticated response.
        // CDN-Cache-Control is Vercel-specific and prevents edge caching in addition to the browser.
        source: "/admin/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "private, no-cache, no-store, must-revalidate",
          },
          {
            key: "CDN-Cache-Control",
            value: "no-store",
          },
        ],
      },
      {
        // API routes are dynamic and may be authenticated; bypass all caching layers.
        source: "/api/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "private, no-cache, no-store, must-revalidate",
          },
          {
            key: "CDN-Cache-Control",
            value: "no-store",
          },
        ],
      },
      {
        // Public pages: cache aggressively at the CDN edge for anonymous visitors.
        // s-maxage=600 — CDN serves cached response for 10 minutes.
        // stale-while-revalidate=86400 — CDN may serve stale for up to 24h while revalidating in the background.
        // Only applies when both Payload cookies are absent; logged-in editors and draft-preview
        // sessions bypass this rule and always hit the origin with fresh responses.
        // The geometry route names its own content in the URL and sets its own (much longer,
        // hash-conditional) Cache-Control — a config-level header always wins over one set in a
        // Route Handler, so without this exclusion this blanket rule silently overwrote it,
        // capping a year-long immutable cache down to 10 minutes.
        // The feed (`/feed`, `/feed/...`; not the `/feed.articles` RSS) is left out too: it's
        // rendered per request, its 404 follows a Site Settings switch that should apply on
        // save, and a stale copy would call load-more's server action with an ID the current
        // build no longer has.
        source: "/:path((?!interactives/[^/]+/regions/[^/]+/geometry/|feed(?:/|$)).*)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, s-maxage=600, stale-while-revalidate=86400",
          },
          {
            key: "CDN-Cache-Control",
            value: "max-age=600, stale-while-revalidate=86400",
          },
        ],
        missing: [
          {
            // Draft preview bypass cookie set by Payload's preview mode.
            type: "cookie",
            key: "__prerender_bypass",
          },
          {
            // Payload auth token — present when an editor is logged in.
            type: "cookie",
            key: "payload-token",
          },
        ],
      },
    ]
  },
  turbopack: {
    root: path.resolve(dirname),
    resolveExtensions: [".mdx", ".tsx", ".ts", ".jsx", ".js", ".mjs", ".json"],
    rules: {
      "*.svg": {
        loaders: ["@svgr/webpack"],
        as: "*.js",
      },
    },
  },
}

export default withSentryConfig(withPayload(nextConfig, { devBundleServerPackages: false }), {
  // For all available options, see:
  // https://www.npmjs.com/package/@sentry/webpack-plugin#options

  org: "digital-ground-game",

  project: "pragmatic-papers",

  // Tags our bundled code with this key so `thirdPartyErrorFilterIntegration`
  // (in src/instrumentation-client.ts) can tell our frames from third-party ones.
  // Top-level `applicationKey` injects module metadata for both webpack and Turbopack.
  applicationKey: "pragmatic-papers",

  // The build-time dependency instrumentation roughly doubles peak compile memory
  // (~4.6 → ~8.5 GiB), more than the Coolify build server's 8 GB of RAM (#1018).
  buildTimeInstrumentation: false,

  // Log wherever source maps are uploaded: builds with SENTRY_AUTH_TOKEN (Coolify
  // production/staging). GitHub Actions deliberately has no token.
  silent: !process.env.SENTRY_AUTH_TOKEN,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Preview errors are rarely debugged in Sentry, so skip generating and uploading
  // source maps there (~1 min off each preview build).
  sourcemaps: {
    disable: process.env.BUILD_ENV === "preview",
  },

  // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // This can increase your server load as well as your hosting bill.
  // Note: This needs to not conflict with our Next.js middleware/proxy.ts, otherwise reporting of client-
  // side errors will fail.
  tunnelRoute: "/monitoring",

  webpack: {
    // Tree-shaking options for reducing bundle size
    treeshake: {
      // Automatically tree-shake Sentry logger statements to reduce bundle size
      removeDebugLogging: true,
    },
  },
})
