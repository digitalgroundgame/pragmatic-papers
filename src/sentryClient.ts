// The browser's Sentry, loaded once the reader does something rather than with the page.
//
// The parts of the SDK we use are ~65 kB of gzipped JavaScript. Imported statically, they
// land in the chunks every page loads first, and when they arrive before the first paint
// (a fast network, or a returning reader's cache) evaluating them holds that paint back:
// by over a second in Lighthouse runs. Loaded straight after `load`, evaluating them is
// still a long task while the page is settling. So nothing on the client imports
// `@sentry/nextjs` directly, and only sentryClient.ts imports sentrySdk.ts.
// `startSentryOnFirstInput` (from instrumentation-client.ts) loads it on the reader's first
// input, or once the page has sat idle a while, and keeps errors thrown before then to report
// once it's up; anything else that reports goes through `captureException` /
// `captureMessage` here, which load it on demand. Either way it is initialised once, by
// `loadSentry`.

import type * as SentrySDK from "./sentrySdk"

type Sentry = typeof SentrySDK

let loading: Promise<Sentry> | undefined
let user: Parameters<Sentry["setUser"]>[0] = null

/** Sentry, imported and initialised on the first call. */
export function loadSentry(): Promise<Sentry> {
  // A module of our own rather than `@sentry/nextjs` itself: a dynamic import keeps the
  // whole namespace it names, so importing the package directly would ship every
  // integration (161 kB gzipped against 62 kB), where sentrySdk.ts imports what we use.
  loading ??= import("./sentrySdk")
    .then((Sentry) => {
      Sentry.initSentry()
      if (user) Sentry.setUser(user)
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
 * Who later reports are from, as Sentry's `setUser`. Doesn't load Sentry: it is applied
 * when Sentry loads, or now if it already has.
 */
export function setUser(next: Parameters<Sentry["setUser"]>[0]): void {
  user = next
  loading?.then((Sentry) => Sentry.setUser(next), ignore)
}

/**
 * Reports each error logged through `con.error`. For the admin panel, where Payload's own
 * error boundaries (a rich-text field's "Something went wrong") catch a crash, and React
 * hands a caught error to Next, which only logs it, through a `console.error` it keeps a
 * reference to as it loads. So this has to run first, from instrumentation-client.ts: once
 * the page has loaded, wrapping `console.error` (Sentry's own console integrations included)
 * no longer sees them. Everything else the admin logs as an error is reported too.
 */
export function reportConsoleErrors(con: Pick<Console, "error"> = console): void {
  const original = con.error
  con.error = function (...args: unknown[]) {
    const error = args.find((arg) => arg instanceof Error)
    // A task later: a crash that reaches global-error.tsx is logged here first, and Sentry
    // reports an error once, so this would report it as handled. Deferred, global-error's
    // own report (from an effect React runs as it commits the error page) is first.
    if (error) {
      setTimeout(() => {
        captureException(error, { mechanism: { handled: true, type: "auto.console.admin" } })
      }, 0)
    }
    original.apply(this, args)
  }
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

// What counts as the reader's first input. Scroll covers wheel, keys and touch alike; it is
// listened for in the capture phase, as it doesn't bubble from the element that scrolled.
const INPUTS = ["pointerdown", "keydown", "touchstart", "scroll"] as const

/**
 * Loads Sentry on the reader's first input (a press, a key, a touch or a scroll), when the
 * browser is next idle, or, for a reader who never does any of those, `fallback` ms after
 * `load`. Before then, the first error from our own scripts, or unhandled rejection that isn't
 * a failed load, loads it at once, as Sentry's own Loader Script does: a reader who hits an
 * error and leaves straight away is still reported. An error from a script we don't serve is
 * kept but doesn't hurry the load: Cloudflare's beacon would otherwise bring Sentry in before
 * the first paint on every page. Those early errors are kept and reported once it's up, marked
 * unhandled as Sentry's global handlers mark them; from then on those handlers catch
 * everything. Returns a `onRouterTransitionStart` for instrumentation-client.ts, which does
 * nothing until Sentry has loaded: a client-side navigation is an input, so Sentry is on its
 * way by then, and its pageload span already covers the page.
 *
 * Sentry recommends initialising as early as possible and names this trade-off: requests
 * and clicks before it loads leave no spans or breadcrumbs, and a reader who leaves without
 * an input or an error before `fallback` sends nothing, the pageload span included. The
 * pageload span and web vitals are otherwise unaffected, since the SDK reads them from
 * buffered performance entries.
 */
export function startSentryOnFirstInput(
  win: Window = window,
  { fallback = 10_000, timeout = 2000 }: { fallback?: number; timeout?: number } = {},
): Sentry["captureRouterTransitionStart"] {
  let sentry: Sentry | undefined
  let started = false
  const early: { error: unknown; handler: "onerror" | "onunhandledrejection" }[] = []
  // Aborted once Sentry is up, which removes every listener below.
  const listening = new AbortController()
  // Aborted at the first input, or at the fallback, which removes the input listeners.
  const waiting = new AbortController()

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

  // Not in the input's own task: evaluating the SDK there would hold up the reader's response.
  const whenIdle = () => {
    if (waiting.signal.aborted) return
    waiting.abort()
    if (typeof win.requestIdleCallback === "function") win.requestIdleCallback(start, { timeout })
    else win.setTimeout(start, 0)
  }
  for (const input of INPUTS) {
    win.addEventListener(input, whenIdle, {
      capture: true,
      once: true,
      passive: true,
      signal: waiting.signal,
    })
  }
  const afterLoad = () => win.setTimeout(whenIdle, fallback)
  if (win.document.readyState === "complete") afterLoad()
  else win.addEventListener("load", afterLoad, { once: true, signal: waiting.signal })

  return (...args) => sentry?.captureRouterTransitionStart(...args)
}
