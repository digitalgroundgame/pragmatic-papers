// The browser's Sentry, loaded once the page has painted rather than before it.
//
// The parts of the SDK we use are ~65 kB of gzipped JavaScript. Imported statically, they
// land in the chunks every page loads first, and when they arrive before the first paint
// (a fast network, or a returning reader's cache) evaluating them holds that paint back:
// by over a second in Lighthouse runs. So nothing on the client imports `@sentry/nextjs`
// directly, and only sentryClient.ts imports sentrySdk.ts.
// `startSentryWhenIdle` (from instrumentation-client.ts) loads it after `load`, when the
// browser is idle, and keeps errors thrown before then to report once it's up; anything
// else that reports goes through `captureException` / `captureMessage` here, which load
// it on demand. Either way it is initialised once, by `loadSentry`.

import type * as SentrySDK from "./sentrySdk"

type Sentry = typeof SentrySDK

let loading: Promise<Sentry> | undefined

/** Sentry, imported and initialised on the first call. */
export function loadSentry(): Promise<Sentry> {
  // A module of our own rather than `@sentry/nextjs` itself: a dynamic import keeps the
  // whole namespace it names, so importing the package directly would ship every
  // integration (161 kB gzipped against 62 kB), where sentrySdk.ts imports what we use.
  loading ??= import("./sentrySdk")
    .then((Sentry) => {
      Sentry.initSentry()
      return Sentry
    })
    .catch((error: unknown) => {
      // The chunk didn't arrive (a dropped connection, or a deploy that replaced it under
      // an open page), or init threw. Forget the failure so the next report tries again.
      loading = undefined
      throw error
    })
  return loading
}

// A failed load is swallowed here: it would otherwise surface as an unhandled rejection,
// which has nowhere to be reported either.
const ignore = (): void => undefined

export function captureException(...args: Parameters<Sentry["captureException"]>): void {
  loadSentry().then((Sentry) => Sentry.captureException(...args), ignore)
}

export function captureMessage(...args: Parameters<Sentry["captureMessage"]>): void {
  loadSentry().then((Sentry) => Sentry.captureMessage(...args), ignore)
}

/**
 * Whether an error event's script is one of our chunks. Cloudflare injects scripts under
 * `/cdn-cgi/` and inline into the HTML, where an error's filename is the page's own URL
 * (its RUM beacon throws on our JSON-LD); our own inline scripts are only Next's data
 * pushes, which don't throw. Extensions run from their own schemes, and a cross-origin
 * script's error arrives muted, with no filename.
 */
function isOurScript(filename: string, location: Location): boolean {
  if (!filename) return false
  try {
    const url = new URL(filename)
    const page = new URL(location.href)
    url.hash = page.hash = ""
    return (
      url.origin === location.origin &&
      !url.pathname.startsWith("/cdn-cgi/") &&
      url.href !== page.href
    )
  } catch {
    return false
  }
}

/**
 * Loads Sentry once the page has loaded and the browser is idle (or after `timeout` ms
 * idle-waiting, whichever comes first), or at once on the first error from our own
 * scripts, or unhandled rejection that isn't a failed load, before then, as Sentry's own
 * Loader Script does: a reader who hits an error and leaves straight away is still
 * reported. An error from a script we don't serve is kept but doesn't hurry the load:
 * Cloudflare's beacon would otherwise bring Sentry in before the first paint on every
 * page. Those early errors are kept and reported once it's up, marked unhandled as
 * Sentry's global handlers mark them; from then on those handlers catch everything. Returns a `onRouterTransitionStart` for
 * instrumentation-client.ts, which does nothing until Sentry has loaded: a navigation that
 * early is the page's own, which Sentry's pageload span already covers.
 *
 * Sentry recommends initialising as early as possible and names this trade-off: requests
 * and clicks before it loads leave no spans or breadcrumbs. The pageload span and web
 * vitals are unaffected, since the SDK reads them from buffered performance entries.
 */
export function startSentryWhenIdle(
  win: Window = window,
  { timeout = 5000 }: { timeout?: number } = {},
): Sentry["captureRouterTransitionStart"] {
  let sentry: Sentry | undefined
  let started = false
  const early: { error: unknown; handler: "onerror" | "onunhandledrejection" }[] = []
  // Aborted once Sentry is up, which removes both listeners below.
  const listening = new AbortController()

  const start = () => {
    if (started) return
    started = true
    loadSentry().then(
      (loaded) => {
        listening.abort()
        for (const { error, handler } of early.splice(0)) {
          loaded.captureException(error, {
            mechanism: { handled: false, type: `auto.browser.global_handlers.${handler}` },
          })
        }
        sentry = loaded
      },
      // Keep listening, and keep what was caught: the next error tries the load again.
      () => {
        started = false
      },
    )
  }
  const keep = (error: unknown, handler: (typeof early)[number]["handler"], loadNow = true) => {
    early.push({ error, handler })
    if (loadNow) start()
  }
  win.addEventListener(
    "error",
    (event) =>
      keep(event.error ?? event.message, "onerror", isOurScript(event.filename, win.location)),
    { signal: listening.signal },
  )
  win.addEventListener(
    "unhandledrejection",
    // A rejection with a DOM Event as its reason is almost always a script or image that
    // failed to load, usually someone else's, and carries no stack to act on: kept, but
    // not worth loading Sentry before the first paint for.
    (event) => keep(event.reason, "onunhandledrejection", !(event.reason instanceof Event)),
    { signal: listening.signal },
  )

  const whenIdle = () => {
    if (typeof win.requestIdleCallback === "function") win.requestIdleCallback(start, { timeout })
    else win.setTimeout(start, 0)
  }
  if (win.document.readyState === "complete") whenIdle()
  else win.addEventListener("load", whenIdle, { once: true })

  return (...args) => sentry?.captureRouterTransitionStart(...args)
}
