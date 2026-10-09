/**
 * The Next config for the Cloudflare Worker build (`pnpm build:worker`, which sets
 * `OPENNEXT_BUILD=true`). The Worker serves the public site; the admin panel, Payload's
 * REST API, uploads, migrations and jobs stay on Coolify, so the packages only those
 * need are swapped for `stubs/unavailable.ts`.
 *
 * Webpack only: Turbopack copies the Payload config's module graph into every route
 * group's chunks, which puts the Worker far over Cloudflare's size limit.
 */
import type { NextConfig } from "next"
import { fileURLToPath } from "url"

/** Packages a Worker can't load and the public site never calls. */
export const WORKER_STUBS = [
  // Migrations and schema push. withPayload leaves it out of Next's traces, so the
  // Worker bundle couldn't resolve it anyway.
  "drizzle-kit/api",
  // Native. Uploads, the only callers, run on Coolify.
  "sharp",
  // Only the updateRecommendations job uses it, and it's ~17 MB with its gRPC stack.
  "@google-analytics/data",
]

const STUB = fileURLToPath(new URL("./stubs/unavailable.ts", import.meta.url))

const isStubbed = (external: unknown): boolean =>
  typeof external === "string" && (external === "drizzle-kit" || WORKER_STUBS.includes(external))

export function withCloudflare(base: NextConfig): NextConfig {
  return {
    ...base,
    // Links navigate client-side with next/link (HoverPrefetchLink).
    env: { ...base.env, NEXT_PUBLIC_CLIENT_NAVIGATION: "true" },
    // In a Worker, pg connects through pg-cloudflare, which Next's trace (run under Node)
    // never reaches, so OpenNext wouldn't copy it into the Worker bundle.
    outputFileTracingIncludes: {
      ...base.outputFileTracingIncludes,
      "/**/*": ["./node_modules/.pnpm/pg-cloudflare@*/node_modules/pg-cloudflare/**/*"],
    },
    // Webpack checks `serverExternalPackages` before aliases, so the stubbed packages
    // come off that list.
    serverExternalPackages: base.serverExternalPackages?.filter((name) => !isStubbed(name)),
    webpack: (webpackConfig, options) => {
      const resolved = base.webpack ? base.webpack(webpackConfig, options) : webpackConfig
      // withPayload's own webpack function lists them in `externals` as well.
      if (Array.isArray(resolved.externals)) {
        resolved.externals = resolved.externals.filter((external: unknown) => !isStubbed(external))
      }
      // Left to webpack, pg resolves pg-cloudflare under Node's conditions and gets its
      // empty build. External, it's bundled by OpenNext's esbuild with `workerd`.
      if (options.isServer) resolved.externals = [...(resolved.externals ?? []), "pg"]
      resolved.resolve.alias = {
        ...resolved.resolve.alias,
        ...Object.fromEntries(WORKER_STUBS.map((name) => [`${name}$`, STUB])),
      }
      // Next keeps sharp external whatever the aliases say, so swap our own module
      // that imports it (./sharp.ts) instead.
      resolved.plugins.push(
        new options.webpack.NormalModuleReplacementPlugin(
          /src[\\/]cloudflare[\\/]sharp\.ts$/,
          STUB,
        ),
      )
      return resolved
    },
  }
}
