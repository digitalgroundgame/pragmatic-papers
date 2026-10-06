import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const sdk = vi.hoisted(() => ({
  init: vi.fn(),
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  captureRouterTransitionStart: vi.fn(),
  thirdPartyErrorFilterIntegration: vi.fn(() => ({ name: "ThirdPartyErrorsFilter" })),
}))
vi.mock("@sentry/nextjs", () => sdk)

// sentryClient keeps the loaded SDK in module state, so each test imports a fresh copy.
const importClient = async () => {
  vi.resetModules()
  return import("../sentryClient")
}

// Lets the dynamic import and the `.then`s after it settle.
const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

const ORIGIN = "https://pragmaticpapers.test"
const OUR_SCRIPT = `${ORIGIN}/_next/static/chunks/app.js`

/** A window whose load and idle callbacks the test fires by hand. */
function fakeWindow({ readyState = "loading", idle = true } = {}) {
  const target = new EventTarget()
  const idleCallbacks: (() => void)[] = []
  const win = Object.assign(target, {
    document: { readyState },
    location: { origin: ORIGIN },
    requestIdleCallback: idle
      ? vi.fn((callback: () => void) => {
          idleCallbacks.push(callback)
          return idleCallbacks.length
        })
      : undefined,
    setTimeout: vi.fn((callback: () => void) => {
      idleCallbacks.push(callback)
      return idleCallbacks.length
    }),
  })
  const runIdle = () => idleCallbacks.splice(0).forEach((callback) => callback())
  return { win: win as unknown as Window, runIdle }
}

const errorEvent = (error: Error, filename = OUR_SCRIPT) =>
  new ErrorEvent("error", { error, message: error.message, filename })

beforeEach(() => {
  document.documentElement.dataset.sentryDsn = "https://key@o1.ingest.sentry.io/2"
  document.documentElement.dataset.sentryEnvironment = "staging"
  document.documentElement.dataset.sentryPr = "1141"
})

afterEach(() => {
  vi.clearAllMocks()
  delete document.documentElement.dataset.sentryDsn
  delete document.documentElement.dataset.sentryEnvironment
  delete document.documentElement.dataset.sentryPr
})

describe("loadSentry", () => {
  it("initialises Sentry once, from the config on <html>", async () => {
    const { loadSentry } = await importClient()
    const [first, second] = await Promise.all([loadSentry(), loadSentry()])

    expect(first).toBe(second)
    expect(sdk.init).toHaveBeenCalledTimes(1)
    expect(sdk.init).toHaveBeenCalledWith(
      expect.objectContaining({
        dsn: "https://key@o1.ingest.sentry.io/2",
        environment: "staging",
        initialScope: { tags: { pr: "1141" } },
        tracesSampleRate: 0.1,
      }),
    )
  })

  it("tags nothing outside a PR preview", async () => {
    delete document.documentElement.dataset.sentryPr
    const { loadSentry } = await importClient()
    await loadSentry()
    expect(sdk.init).toHaveBeenCalledWith(expect.objectContaining({ initialScope: undefined }))
  })

  it("reports nothing without a DSN on <html>", async () => {
    delete document.documentElement.dataset.sentryDsn
    const { loadSentry } = await importClient()
    await loadSentry()
    expect(sdk.init).toHaveBeenCalledWith(expect.objectContaining({ dsn: undefined }))
  })
})

describe("a failed load", () => {
  // Stands in for the chunk failing to arrive: either way the load rejects.
  const failOnce = () =>
    sdk.init.mockImplementationOnce(() => {
      throw new Error("chunk failed to load")
    })

  it("is tried again on the next report, and reports nothing meanwhile", async () => {
    failOnce()
    const { captureException } = await importClient()
    const rejections: unknown[] = []
    const onRejection = (reason: unknown) => rejections.push(reason)
    process.on("unhandledRejection", onRejection)

    captureException(new Error("first"))
    await settle()
    expect(sdk.captureException).not.toHaveBeenCalled()

    const second = new Error("second")
    captureException(second)
    await settle()
    process.off("unhandledRejection", onRejection)

    expect(sdk.init).toHaveBeenCalledTimes(2)
    expect(sdk.captureException).toHaveBeenCalledExactlyOnceWith(second)
    expect(rejections).toEqual([])
  })

  it("keeps early errors and listening, so the next error tries again", async () => {
    failOnce()
    const { startSentryWhenIdle } = await importClient()
    const { win } = fakeWindow()
    startSentryWhenIdle(win)

    const first = new Error("first")
    win.dispatchEvent(errorEvent(first))
    await settle()
    expect(sdk.captureException).not.toHaveBeenCalled()

    const second = new Error("second")
    win.dispatchEvent(errorEvent(second))
    await settle()

    const unhandled = {
      mechanism: { handled: false, type: "auto.browser.global_handlers.onerror" },
    }
    expect(sdk.captureException.mock.calls).toEqual([
      [first, unhandled],
      [second, unhandled],
    ])
  })
})

describe("captureException and captureMessage", () => {
  it("load Sentry on demand, initialised before the report", async () => {
    const { captureException, captureMessage } = await importClient()
    const error = new Error("boom")
    captureException(error)
    captureMessage("MathJax failed to load", { level: "warning" })
    await settle()

    expect(sdk.init).toHaveBeenCalledTimes(1)
    expect(sdk.init.mock.invocationCallOrder[0]).toBeLessThan(
      sdk.captureException.mock.invocationCallOrder[0]!,
    )
    expect(sdk.captureException).toHaveBeenCalledWith(error)
    expect(sdk.captureMessage).toHaveBeenCalledWith("MathJax failed to load", { level: "warning" })
  })
})

describe("startSentryWhenIdle", () => {
  it("waits for load, then for the browser to be idle", async () => {
    const { startSentryWhenIdle } = await importClient()
    const { win, runIdle } = fakeWindow()
    startSentryWhenIdle(win, { timeout: 1234 })
    await settle()
    expect(sdk.init).not.toHaveBeenCalled()

    win.dispatchEvent(new Event("load"))
    expect(win.requestIdleCallback).toHaveBeenCalledWith(expect.any(Function), { timeout: 1234 })
    await settle()
    expect(sdk.init).not.toHaveBeenCalled()

    runIdle()
    await settle()
    expect(sdk.init).toHaveBeenCalledTimes(1)
  })

  it("starts straight away on a page that has already loaded", async () => {
    const { startSentryWhenIdle } = await importClient()
    const { win, runIdle } = fakeWindow({ readyState: "complete" })
    startSentryWhenIdle(win)
    runIdle()
    await settle()
    expect(sdk.init).toHaveBeenCalledTimes(1)
  })

  it("falls back to a timeout without requestIdleCallback", async () => {
    const { startSentryWhenIdle } = await importClient()
    const { win, runIdle } = fakeWindow({ readyState: "complete", idle: false })
    startSentryWhenIdle(win)
    expect(win.setTimeout).toHaveBeenCalledWith(expect.any(Function), 0)
    runIdle()
    await settle()
    expect(sdk.init).toHaveBeenCalledTimes(1)
  })

  const unhandled = (handler: string) => ({
    mechanism: { handled: false, type: `auto.browser.global_handlers.${handler}` },
  })

  it("loads Sentry at once on an error before the page has loaded, and only once", async () => {
    const { startSentryWhenIdle } = await importClient()
    const { win, runIdle } = fakeWindow()
    startSentryWhenIdle(win)

    win.dispatchEvent(errorEvent(new Error("early")))
    await settle()
    // Neither `load` nor an idle moment has come: the error alone brought Sentry in.
    expect(sdk.init).toHaveBeenCalledTimes(1)

    win.dispatchEvent(new Event("load"))
    runIdle()
    await settle()
    expect(sdk.init).toHaveBeenCalledTimes(1)
  })

  it("reports errors thrown before Sentry loaded as unhandled, and leaves later ones to Sentry", async () => {
    const { startSentryWhenIdle } = await importClient()
    const { win } = fakeWindow()
    startSentryWhenIdle(win)

    const early = new Error("early")
    win.dispatchEvent(errorEvent(early))
    const rejection = new Event("unhandledrejection")
    Object.assign(rejection, { reason: "rejected early" })
    win.dispatchEvent(rejection)
    await settle()

    expect(sdk.captureException.mock.calls).toEqual([
      [early, unhandled("onerror")],
      ["rejected early", unhandled("onunhandledrejection")],
    ])

    win.dispatchEvent(errorEvent(new Error("late")))
    expect(sdk.captureException).toHaveBeenCalledTimes(2)
  })

  it("reports an early error's message when it carries no Error", async () => {
    const { startSentryWhenIdle } = await importClient()
    const { win } = fakeWindow()
    startSentryWhenIdle(win)

    win.dispatchEvent(new ErrorEvent("error", { message: "Muted.", filename: OUR_SCRIPT }))
    await settle()
    expect(sdk.captureException).toHaveBeenCalledExactlyOnceWith("Muted.", unhandled("onerror"))
  })

  it.each([
    ["Cloudflare's beacon", `${ORIGIN}/cdn-cgi/rum?v=1`],
    ["another origin", "https://ads.example/tag.js"],
    ["an extension", "chrome-extension://abc/content.js"],
    ["a muted cross-origin script", ""],
  ])("keeps an early error from %s without hurrying the load", async (_, filename) => {
    const { startSentryWhenIdle } = await importClient()
    const { win, runIdle } = fakeWindow()
    startSentryWhenIdle(win)

    const error = new Error("not ours")
    win.dispatchEvent(errorEvent(error, filename))
    await settle()
    expect(sdk.init).not.toHaveBeenCalled()

    win.dispatchEvent(new Event("load"))
    runIdle()
    await settle()
    expect(sdk.captureException).toHaveBeenCalledExactlyOnceWith(error, unhandled("onerror"))
  })

  it("forwards router transitions only once Sentry has loaded", async () => {
    const { startSentryWhenIdle } = await importClient()
    const { win, runIdle } = fakeWindow({ readyState: "complete" })
    const onRouterTransitionStart = startSentryWhenIdle(win)

    onRouterTransitionStart("/articles/a", "push")
    expect(sdk.captureRouterTransitionStart).not.toHaveBeenCalled()

    runIdle()
    await settle()
    onRouterTransitionStart("/articles/b", "push")
    expect(sdk.captureRouterTransitionStart).toHaveBeenCalledExactlyOnceWith("/articles/b", "push")
  })
})
