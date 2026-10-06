# Sentry docs (`getsentry/sentry-docs`)

Site: `https://docs.sentry.io/<path without .mdx>/`. The Next.js guide is thin: most pages live
under the JavaScript "common" tree and pull platform snippets from `<PlatformContent
includePath="x" />` → `platform-includes/x/` (not checked out by default; pass that path) and
`<Include name="x" />` → `includes/x` (checked out).

| Question                                                                                     | Path                                                                                                          |
| -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Next.js setup: `instrumentation.ts`, `instrumentation-client.ts`, `sentry.*.config.ts`       | `docs/platforms/javascript/guides/nextjs/manual-setup/index.mdx`                                              |
| `withSentryConfig` build options, tunnel, source map upload                                  | `docs/platforms/javascript/guides/nextjs/configuration/build/index.mdx`                                       |
| `Sentry.init` options (`environment`, `release`, `tracesSampleRate`, `dataCollection`…)      | `docs/platforms/javascript/common/configuration/options.mdx`                                                  |
| Dropping noise: `ignoreErrors`, `denyUrls`, `beforeSend`, `thirdPartyErrorFilterIntegration` | `docs/platforms/javascript/common/configuration/filtering.mdx`, `configuration/integrations/eventfilters.mdx` |
| Any integration's options                                                                    | `docs/platforms/javascript/common/configuration/integrations/<name>.mdx`                                      |
| Sampling                                                                                     | `docs/platforms/javascript/common/sampling.mdx`                                                               |
| Source maps missing or wrong                                                                 | `docs/platforms/javascript/common/sourcemaps/`, `sourcemaps/troubleshooting_js/`                              |
| Releases and environments                                                                    | `docs/platforms/javascript/common/configuration/releases.mdx`                                                 |
| Tracing, logs, crons                                                                         | `docs/platforms/javascript/common/tracing/`, `logs/`, `crons/`                                                |

Our setup: `sentry.server.config.ts`, `sentry.edge.config.ts`, `src/instrumentation-client.ts`,
and the `withSentryConfig` block in `next.config.ts`.
