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

/** A window whose load and idle callbacks the test fires by hand. */
function fakeWindow({ readyState = "loading", idle = true } = {}) {
  const target = new EventTarget()
  const idleCallbacks: (() => void)[] = []
  const win = Object.assign(target, {
    document: { readyState },
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

const errorEvent = (error: Error) => new ErrorEvent("error", { error, message: error.message })

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

  it("reports nothing without a DSN on <html>", async () => {
    delete document.documentElement.dataset.sentryDsn
    const { loadSentry } = await importClient()
    await loadSentry()
    expect(sdk.init).toHaveBeenCalledWith(expect.objectContaining({ dsn: undefined }))
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

  it("reports errors thrown before Sentry loaded, and leaves later ones to Sentry", async () => {
    const { startSentryWhenIdle } = await importClient()
    const { win, runIdle } = fakeWindow({ readyState: "complete" })
    startSentryWhenIdle(win)

    const early = new Error("early")
    win.dispatchEvent(errorEvent(early))
    const rejection = new Event("unhandledrejection")
    Object.assign(rejection, { reason: "rejected early" })
    win.dispatchEvent(rejection)

    runIdle()
    await settle()
    expect(sdk.captureException.mock.calls).toEqual([[early], ["rejected early"]])

    win.dispatchEvent(errorEvent(new Error("late")))
    expect(sdk.captureException).toHaveBeenCalledTimes(2)
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
