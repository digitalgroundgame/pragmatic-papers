/**
 * Which deploy a build is, as Sentry should see it. `next.config.ts` resolves this once at
 * build time (the only place `BUILD_ENV` is visible) and inlines it through `env` as
 * `SENTRY_ENVIRONMENT` / `SENTRY_PR`, so the client, server and edge configs share one value.
 *
 * The environment is `BUILD_ENV` itself (`production`, `staging` or `preview`), so the value
 * that picks a deploy's database and newsletter namespace also names it in Sentry, and the
 * two can't disagree. One `preview` environment covers every PR, so Sentry's environment
 * list doesn't grow with each one; the `pr` tag tells them apart. Without `BUILD_ENV`
 * (`pnpm dev`, CI) it's `development`. `||`, not `??`: a blank variable falls back too.
 */
export interface SentryDeployment {
  environment: string
  /** The PR number of a preview (`986` for `pr-986.pragmaticpapers.com`); `""` otherwise. */
  pr: string
}

export function resolveSentryDeployment(env: {
  BUILD_ENV?: string
  COOLIFY_FQDN?: string
}): SentryDeployment {
  const environment = env.BUILD_ENV || "development"
  // Coolify sets COOLIFY_FQDN to the preview's host, e.g. `pr-986.pragmaticpapers.com`
  // (with or without a scheme). No match leaves the tag unset rather than wrong.
  const pr =
    environment === "preview" ? (env.COOLIFY_FQDN?.match(/(?:^|\/\/)pr-(\d+)\./)?.[1] ?? "") : ""
  return { environment, pr }
}
