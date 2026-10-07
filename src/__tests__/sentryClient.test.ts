import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const sdk = vi.hoisted(() => ({
  init: vi.fn(),
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  captureRouterTransitionStart: vi.fn(),
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
const PAGE = `${ORIGIN}/volumes/3#footnote-1`

/** A window whose load, timers and idle callbacks the test fires by hand. */
function fakeWindow({ readyState = "loading", idle = true } = {}) {
  const target = new EventTarget()
  const idleCallbacks: (() => void)[] = []
  const timers: (() => void)[] = []
  const win = Object.assign(target, {
    document: { readyState },
    location: { origin: ORIGIN, href: PAGE },
    requestIdleCallback: idle
      ? vi.fn((callback: () => void) => {
          idleCallbacks.push(callback)
          return idleCallbacks.length
        })
      : undefined,
    setTimeout: vi.fn((callback: () => void) => {
      timers.push(callback)
      return timers.length
    }),
  })
  const runIdle = () => idleCallbacks.splice(0).forEach((callback) => callback())
  const runTimers = () => timers.splice(0).forEach((callback) => callback())
  const input = (type = "pointerdown") => win.dispatchEvent(new Event(type))
  return { win: win as unknown as Window, runIdle, runTimers, input }
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
        tracesSampler: expect.any(Function),
        tunnel: "/monitoring",
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
    const { startSentryOnFirstInput } = await importClient()
    const { win } = fakeWindow()
    startSentryOnFirstInput(win)

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

describe("startSentryOnFirstInput", () => {
  it("waits for the reader's first input, then for the browser to be idle", async () => {
    const { startSentryOnFirstInput } = await importClient()
    const { win, runIdle, input } = fakeWindow()
    startSentryOnFirstInput(win, { timeout: 1234 })
    win.dispatchEvent(new Event("load"))
    await settle()
    expect(win.requestIdleCallback).not.toHaveBeenCalled()

    input()
    expect(win.requestIdleCallback).toHaveBeenCalledWith(expect.any(Function), { timeout: 1234 })
    await settle()
    expect(sdk.init).not.toHaveBeenCalled()

    runIdle()
    await settle()
    expect(sdk.init).toHaveBeenCalledTimes(1)
  })

  it.each(["pointerdown", "keydown", "touchstart", "scroll"])(
    "takes %s as an input, before load too",
    async (type) => {
      const { startSentryOnFirstInput } = await importClient()
      const { win, runIdle, input } = fakeWindow()
      startSentryOnFirstInput(win)
      input(type)
      runIdle()
      await settle()
      expect(sdk.init).toHaveBeenCalledTimes(1)
    },
  )

  it("asks for the load once, however many inputs come", async () => {
    const { startSentryOnFirstInput } = await importClient()
    const { win, input } = fakeWindow({ readyState: "complete" })
    startSentryOnFirstInput(win)
    input("pointerdown")
    input("keydown")
    input("scroll")
    expect(win.requestIdleCallback).toHaveBeenCalledTimes(1)
  })

  it("loads it `fallback` ms after load for a reader who never does anything", async () => {
    const { startSentryOnFirstInput } = await importClient()
    const { win, runIdle, runTimers, input } = fakeWindow()
    startSentryOnFirstInput(win, { fallback: 4321 })
    expect(win.setTimeout).not.toHaveBeenCalled()

    win.dispatchEvent(new Event("load"))
    expect(win.setTimeout).toHaveBeenCalledWith(expect.any(Function), 4321)
    runTimers()
    runIdle()
    await settle()
    expect(sdk.init).toHaveBeenCalledTimes(1)

    // The inputs have stopped listening.
    input()
    expect(win.requestIdleCallback).toHaveBeenCalledTimes(1)
  })

  it("counts the fallback from now on a page that has already loaded", async () => {
    const { startSentryOnFirstInput } = await importClient()
    const { win } = fakeWindow({ readyState: "complete" })
    startSentryOnFirstInput(win, { fallback: 4321 })
    expect(win.setTimeout).toHaveBeenCalledWith(expect.any(Function), 4321)
  })

  it("falls back to a timeout without requestIdleCallback", async () => {
    const { startSentryOnFirstInput } = await importClient()
    const { win, runTimers, input } = fakeWindow({ idle: false })
    startSentryOnFirstInput(win)
    input()
    expect(win.setTimeout).toHaveBeenCalledWith(expect.any(Function), 0)
    runTimers()
    await settle()
    expect(sdk.init).toHaveBeenCalledTimes(1)
  })

  const unhandled = (handler: string) => ({
    mechanism: { handled: false, type: `auto.browser.global_handlers.${handler}` },
  })

  it("loads Sentry at once on an error before the page has loaded, and only once", async () => {
    const { startSentryOnFirstInput } = await importClient()
    const { win, runIdle, input } = fakeWindow()
    startSentryOnFirstInput(win)

    win.dispatchEvent(errorEvent(new Error("early")))
    await settle()
    // Neither `load` nor an input has come: the error alone brought Sentry in.
    expect(sdk.init).toHaveBeenCalledTimes(1)

    win.dispatchEvent(new Event("load"))
    input()
    runIdle()
    await settle()
    expect(sdk.init).toHaveBeenCalledTimes(1)
  })

  it("reports errors thrown before Sentry loaded as unhandled, and leaves later ones to Sentry", async () => {
    const { startSentryOnFirstInput } = await importClient()
    const { win } = fakeWindow()
    startSentryOnFirstInput(win)

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
    const { startSentryOnFirstInput } = await importClient()
    const { win } = fakeWindow()
    startSentryOnFirstInput(win)

    win.dispatchEvent(new ErrorEvent("error", { message: "Muted.", filename: OUR_SCRIPT }))
    await settle()
    expect(sdk.captureException).toHaveBeenCalledExactlyOnceWith("Muted.", unhandled("onerror"))
  })

  it.each([
    ["Cloudflare's beacon", `${ORIGIN}/cdn-cgi/rum?v=1`],
    ["a script injected inline into the page", `${ORIGIN}/volumes/3`],
    ["another origin", "https://ads.example/tag.js"],
    ["an extension", "chrome-extension://abc/content.js"],
    ["a muted cross-origin script", ""],
  ])("keeps an early error from %s without hurrying the load", async (_, filename) => {
    const { startSentryOnFirstInput } = await importClient()
    const { win, runIdle, input } = fakeWindow()
    startSentryOnFirstInput(win)

    const error = new Error("not ours")
    win.dispatchEvent(errorEvent(error, filename))
    await settle()
    expect(sdk.init).not.toHaveBeenCalled()

    win.dispatchEvent(new Event("load"))
    input()
    runIdle()
    await settle()
    expect(sdk.captureException).toHaveBeenCalledExactlyOnceWith(error, unhandled("onerror"))
  })

  it("keeps an early rejection with a DOM Event as its reason without hurrying the load", async () => {
    const { startSentryOnFirstInput } = await importClient()
    const { win, runIdle, input } = fakeWindow()
    startSentryOnFirstInput(win)

    // What a promise wrapping a failed <script> load rejects with.
    const failedLoad = new Event("error")
    const rejection = new Event("unhandledrejection")
    Object.assign(rejection, { reason: failedLoad })
    win.dispatchEvent(rejection)
    await settle()
    expect(sdk.init).not.toHaveBeenCalled()

    win.dispatchEvent(new Event("load"))
    input()
    runIdle()
    await settle()
    expect(sdk.captureException).toHaveBeenCalledExactlyOnceWith(
      failedLoad,
      unhandled("onunhandledrejection"),
    )
  })

  it("forwards router transitions only once Sentry has loaded", async () => {
    const { startSentryOnFirstInput } = await importClient()
    const { win, runIdle, input } = fakeWindow({ readyState: "complete" })
    const onRouterTransitionStart = startSentryOnFirstInput(win)

    onRouterTransitionStart("/articles/a", "push")
    expect(sdk.captureRouterTransitionStart).not.toHaveBeenCalled()

    input()
    runIdle()
    await settle()
    onRouterTransitionStart("/articles/b", "push")
    expect(sdk.captureRouterTransitionStart).toHaveBeenCalledExactlyOnceWith("/articles/b", "push")
  })
})
