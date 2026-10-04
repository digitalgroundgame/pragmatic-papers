import { withSentryConfig } from "@sentry/nextjs/config"
import { withPayload } from "@payloadcms/next/withPayload"
import type { NextConfig } from "next"
import path from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(__filename)

// Read while building, so a Coolify build needs SERVER_URL as a build variable too.
const SERVER_URL = new URL(process.env.SERVER_URL || "http://localhost:8000")

const nextConfig: NextConfig = {
  output: "standalone",
  // Temporarily required on Windows until Next.js fixes Turbopack Sass resolution.
  // See: https://github.com/vercel/next.js/issues/86431
  sassOptions: {
    loadPaths: ["./node_modules/@payloadcms/ui/dist/scss/"],
  },
  images: {
    qualities: [80],
    remotePatterns: [
      {
        protocol: SERVER_URL.protocol.slice(0, -1) as "http" | "https",
        hostname: SERVER_URL.hostname,
        port: SERVER_URL.port,
      },
      {
        // Production's media, which generateFileURL (src/plugins/index.ts) points at
        // SUPABASE_URL's public bucket. Any Supabase project rather than SUPABASE_URL's own
        // host, so the storage host isn't fixed when the image is built.
        // start.sh refuses to start a deployed image whose SUPABASE_URL this doesn't match.
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
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
      // for every Server Action in the app, so this also covers
      // `SocialEmbed/hooks/revalidateSnapshot.ts`. It isn't publicly reachable, so the
      // practical exposure is low; it is still wider than the one flow this was raised for.
      bodySizeLimit: "8mb",
    },
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
        // CDN-Cache-Control (RFC 9213) is for CDNs only. Cloudflare decides caching from it
        // whenever it's present, over Cache-Control, so it keeps the edge from caching too
        // (https://developers.cloudflare.com/cache/concepts/cdn-cache-control/).
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
        // Route Handlers that set their own Cache-Control are left out, because a config-level
        // header always wins over one a Route Handler sets for the same key:
        // - interactives' region, geometry and search JSON (`/interactives/<slug>/regions/...`,
        //   `/interactives/<slug>/search`): an hour at the edge, and geometry, which names its
        //   own content in the URL, is immutable for a year — this rule capped both at 10 min.
        // - the RSS and Substack feeds (`/feed.articles`, `/feed.volumes`,
        //   `/articles/substack.xml`, `/articles/<slug>/substack.xml`): 20 minutes.
        // - `/recommended-articles.json`: no-store.
        // The feed (`/feed`, `/feed/...`; not the `/feed.articles` RSS) is left out too: it's
        // rendered per request, its 404 follows a Site Settings switch that should apply on
        // save, and a stale copy would call load-more's server action with an ID the current
        // build no longer has.
        // The image optimizer (`/_next/image`) is left out as well. It sets its own Cache-Control
        // on each image it serves (images.minimumCacheTTL, or the upstream image's max-age), and
        // Next's docs say to shape that through the upstream image, not /_next/image. It sets
        // none on an error, so under this rule Cloudflare kept the 400 for a missing media file
        // for up to a day (stale-while-revalidate=86400), long after the file came back.
        // `/admin` and `/api` have their own no-store rules above. When rules match the same
        // path the last one wins, so without this exclusion a request without Payload's
        // cookies got this rule's public caching instead. Upload files stay under this rule:
        // with local storage (staging, previews) media and map assets are served from
        // `/api/<collection>/file/...`, anyone can read them, and narration audio and video
        // shouldn't re-download on every load. (Cloudflare's cache rule skips `/api` anyway.)
        source:
          "/:path((?!admin(?:/|$)|api(?:/(?!(?:media|map-assets)/file/)|$)|interactives/[^/]+/(?:regions/|search$)|feed(?:/|$|\\.articles$|\\.volumes$)|articles/(?:[^/]+/)?substack\\.xml$|recommended-articles\\.json$|_next/image$).*)",
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
  // (~4.6 → ~8.5 GiB), more than the Coolify build server's 8 GB of RAM.
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
