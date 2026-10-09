import { withSentryConfig } from "@sentry/nextjs/config"
import { withPayload } from "@payloadcms/next/withPayload"
import type { NextConfig } from "next"
import path from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(__filename)

// Read while building, so a Coolify build needs SERVER_URL as a build variable too.
const SERVER_URL = new URL(process.env.SERVER_URL || "http://localhost:8000")

// Paths the public-page Cache-Control rule in headers() leaves alone, as regexes matched
// against the path after its leading slash.
const NOT_EDGE_CACHED = [
  // `/admin` and `/api` have their own no-store rules. When rules match the same path the
  // last one wins, so without this a request without Payload's cookies got public caching.
  // Upload files stay cached: with local storage (staging, previews) media and map assets
  // are served from `/api/<collection>/file/...`, anyone can read them, and narration audio
  // and video shouldn't re-download on every load. (Cloudflare's cache rule skips `/api`.)
  "admin(?:/|$)",
  "api(?:/(?!(?:media|map-assets)/file/)|$)",

  // Route Handlers that set their own Cache-Control, because a config-level header always
  // wins over one a Route Handler sets for the same key:
  // - interactives' region, geometry and search JSON: an hour at the edge, and geometry,
  //   which names its own content in the URL, is immutable for a year.
  "interactives/[^/]+/(?:regions/|search$)",
  // - the RSS and Substack feeds: 20 minutes.
  "(?:articles|volumes)/feed\\.xml$",
  "articles/(?:[^/]+/)?substack\\.xml$",
  // - recommendations: no-store.
  "recommended-articles\\.json$",

  // The feed page (`/feed`, `/feed/...`) is rendered per request, its 404 follows a Site
  // Settings switch that should apply on save, and a stale copy would call load-more's
  // server action with an ID the current build no longer has.
  "feed(?:/|$)",

  // The image optimizer sets its own Cache-Control on each image it serves
  // (images.minimumCacheTTL, or the upstream image's max-age) and none on an error, so under
  // this rule Cloudflare kept the 400 for a missing media file for up to a day.
  "_next/image$",
]

const nextConfig: NextConfig = {
  output: "standalone",
  // The docs plugin reads src/docs/ when the site starts (syncDocs), which no import traces.
  outputFileTracingIncludes: {
    "/**": ["./src/docs/**/*"],
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
      // for every Server Action in the app, so this also covers the feed's `loadFeedBatch`
      // (`src/app/feed/actions.ts`), which anyone can call, and
      // `SocialEmbed/hooks/revalidateSnapshot.ts`, which only server code calls.
      // `loadFeedBatch` takes a single number, yet a caller can now make Next read and parse up
      // to 8 MB per request instead of 1 MB: low exposure, but wider than the one flow this was
      // raised for.
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
    // The RSS feeds moved under the section they list, ending in `.xml` like
    // every other feed and sitemap. Permanent, so feed readers that
    // honour 301/308 update the URL they have stored.
    { source: "/feed.articles", destination: "/articles/feed.xml", permanent: true },
    { source: "/feed.volumes", destination: "/volumes/feed.xml", permanent: true },
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
        // Every path except those in NOT_EDGE_CACHED, which says why each is left out.
        source: `/:path((?!${NOT_EDGE_CACHED.join("|")}).*)`,
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

// The client-hint headers withPayload adds to every path. Payload's admin reads
// Sec-CH-Prefers-Color-Scheme to render in the editor's light or dark theme, and asks for it
// with Critical-CH, which makes Chrome retry a first visit's navigation to send the hint: a
// whole extra round trip before the first byte (about 570 ms on Home under Lighthouse's
// throttling). Only the admin panel reads it, so only the admin panel asks.
const PAYLOAD_CLIENT_HINTS = ["Accept-CH", "Critical-CH", "Vary"]

/** `config` with Payload's client-hint headers moved from every path to /admin. */
function clientHintsOnlyForAdmin(config: NextConfig): NextConfig {
  const { headers } = config
  if (!headers) return config
  return {
    ...config,
    headers: async () =>
      (await headers()).flatMap((rule) => {
        const isHint = (header: { key: string; value: string }): boolean =>
          PAYLOAD_CLIENT_HINTS.includes(header.key) &&
          header.value === "Sec-CH-Prefers-Color-Scheme"
        if (rule.source !== "/:path*" || !rule.headers.some(isHint)) return [rule]
        const others = rule.headers.filter((header) => !isHint(header))
        return [
          ...(others.length ? [{ ...rule, headers: others }] : []),
          { ...rule, source: "/admin/:path*", headers: rule.headers.filter(isHint) },
        ]
      }),
  }
}

const payloadConfig = clientHintsOnlyForAdmin(
  withPayload(nextConfig, { devBundleServerPackages: false }),
)

export default withSentryConfig(payloadConfig, {
  // For all available options, see:
  // https://www.npmjs.com/package/@sentry/webpack-plugin#options

  org: "digital-ground-game",

  project: "pragmatic-papers",

  // No `applicationKey`: the module metadata it injects into every client module made each
  // one slower to evaluate, about 200 ms of Lighthouse's Total Blocking Time on Home.
  // src/sentryThirdPartyFrames.ts tells our frames from third-party ones by URL instead.

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

  // No `tunnelRoute`: the browser SDK reports through src/app/monitoring/route.ts instead,
  // which says why.

  webpack: {
    // Tree-shaking options for reducing bundle size
    treeshake: {
      // Automatically tree-shake Sentry logger statements to reduce bundle size
      removeDebugLogging: true,
    },
  },
})
