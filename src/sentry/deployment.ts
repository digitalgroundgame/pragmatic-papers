/**
 * Which deploy a build is, as Sentry should see it. `next.config.ts` resolves this once at
 * build time (the only place `BUILD_ENV` is visible) and inlines it through `env` as
 * `SENTRY_ENVIRONMENT` / `SENTRY_PR`, so the client, server and edge configs share one value.
 *
 * - `BUILD_ENV=preview` → environment `preview`, whatever `NEXT_PUBLIC_SENTRY_ENVIRONMENT`
 *   a preview inherits from staging's variables. One environment for every PR, so Sentry's
 *   environment list doesn't grow with each one; `pr` tells them apart.
 * - Otherwise `NEXT_PUBLIC_SENTRY_ENVIRONMENT`, falling back to `NODE_ENV`. `||`, not `??`:
 *   a variable that exists but is blank must fall back rather than report `""`.
 */
export interface SentryDeployment {
  environment: string
  /** The PR number of a preview (`986` for `pr-986.pragmaticpapers.com`); `""` otherwise. */
  pr: string
}

export function resolveSentryDeployment(env: {
  BUILD_ENV?: string
  COOLIFY_FQDN?: string
  NEXT_PUBLIC_SENTRY_ENVIRONMENT?: string
  NODE_ENV?: string
}): SentryDeployment {
  if (env.BUILD_ENV === "preview") {
    // Coolify sets COOLIFY_FQDN to the preview's host, e.g. `pr-986.pragmaticpapers.com`
    // (with or without a scheme). No match leaves the tag unset rather than wrong.
    const pr = env.COOLIFY_FQDN?.match(/(?:^|\/\/)pr-(\d+)\./)?.[1] ?? ""
    return { environment: "preview", pr }
  }
  return {
    environment: env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || env.NODE_ENV || "development",
    pr: "",
  }
}
