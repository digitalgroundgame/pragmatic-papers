// Tells errors from our scripts apart from everyone else's by where their stack frames are
// served from. Imported only by sentrySdk.ts, which loads lazily: see sentryClient.ts.

import type { init } from "@sentry/nextjs"

type Integration = Extract<
  NonNullable<Parameters<typeof init>[0]["integrations"]>,
  unknown[]
>[number]

/** Whether a stack frame's script is one of our chunks: Next serves them all from /_next/. */
export function isOurChunk(filename: string, location: Pick<Location, "origin">): boolean {
  try {
    const url = new URL(filename)
    return url.origin === location.origin && url.pathname.startsWith("/_next/")
  } catch {
    return false
  }
}

/**
 * Tags an error `third_party_code: true` when none of its stack frames is in one of our
 * chunks: browser extensions, Cloudflare's injected scripts (the /cdn-cgi/rum beacon throws
 * `r["@context"].toLowerCase` parsing our JSON-LD), other origins' scripts and inline
 * scripts. It drops nothing; filter the issue stream with `!third_party_code:True`.
 *
 * Which frames count follows Sentry's `thirdPartyErrorFilterIntegration` with
 * `apply-tag-if-exclusively-contains-third-party-frames`, which tagged by module metadata the
 * build injected into every module (`applicationKey`). That metadata made every client module
 * slower to evaluate, so this reads the frames' URLs instead. It runs before Sentry's Next.js
 * integration rewrites frame URLs to `app:///…` and drops their origin.
 */
export function thirdPartyFramesIntegration(
  location: Pick<Location, "origin"> = window.location,
): Integration {
  return {
    name: "ThirdPartyFrames",
    preprocessEvent(event) {
      const values = event.exception?.values
      // Nothing to judge without a stack, as with Sentry's own filter.
      if (!values || values.some((value) => !value.stacktrace)) return
      const frames = values
        .flatMap((value) => value.stacktrace?.frames ?? [])
        .filter(
          (frame) =>
            frame.filename &&
            (frame.lineno != null || frame.colno != null || frame.instruction_addr != null),
        )
      if (frames.every((frame) => !isOurChunk(frame.filename ?? "", location))) {
        event.tags = { ...event.tags, third_party_code: true }
      }
    },
  }
}
