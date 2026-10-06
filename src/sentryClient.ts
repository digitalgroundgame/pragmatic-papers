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
  loading ??= import("./sentrySdk").then((Sentry) => {
    Sentry.initSentry()
    return Sentry
  })
  return loading
}

export function captureException(...args: Parameters<Sentry["captureException"]>): void {
  void loadSentry().then((Sentry) => Sentry.captureException(...args))
}

export function captureMessage(...args: Parameters<Sentry["captureMessage"]>): void {
  void loadSentry().then((Sentry) => Sentry.captureMessage(...args))
}

/**
 * Loads Sentry once the page has loaded and the browser is idle (or after `timeout` ms
 * idle-waiting, whichever comes first), or at once on the first error or unhandled
 * rejection before then, as Sentry's own Loader Script does: a reader who hits an error
 * and leaves straight away is still reported. Those early errors are kept and reported
 * once it's up, marked unhandled as Sentry's global handlers mark them; from then on those
 * handlers catch everything. Returns a `onRouterTransitionStart` for
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
    void loadSentry().then((loaded) => {
      listening.abort()
      for (const { error, handler } of early.splice(0)) {
        loaded.captureException(error, {
          mechanism: { handled: false, type: `auto.browser.global_handlers.${handler}` },
        })
      }
      sentry = loaded
    })
  }
  const keep = (error: unknown, handler: (typeof early)[number]["handler"]) => {
    early.push({ error, handler })
    start()
  }
  win.addEventListener("error", (event) => keep(event.error ?? event.message, "onerror"), {
    signal: listening.signal,
  })
  win.addEventListener(
    "unhandledrejection",
    (event) => keep(event.reason, "onunhandledrejection"),
    {
      signal: listening.signal,
    },
  )

  const whenIdle = () => {
    if (typeof win.requestIdleCallback === "function") win.requestIdleCallback(start, { timeout })
    else win.setTimeout(start, 0)
  }
  if (win.document.readyState === "complete") whenIdle()
  else win.addEventListener("load", whenIdle, { once: true })

  return (...args) => sentry?.captureRouterTransitionStart(...args)
}
