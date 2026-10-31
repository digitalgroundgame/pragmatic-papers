// @vitest-environment node
import { captureException } from "@sentry/cloudflare"
import { describe, expect, it, vi } from "vitest"

import { captureRequestError, init } from "../stubs/sentry"

vi.mock("@sentry/cloudflare", () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  setUser: vi.fn(),
}))

describe("the Worker's @sentry/nextjs stub", () => {
  it("reports a failed render through @sentry/cloudflare, with its route", () => {
    const error = new Error("render failed")
    captureRequestError(
      error,
      { path: "/articles/a", method: "GET" },
      { routePath: "/articles/[slug]", routeType: "render" },
    )
    expect(captureException).toHaveBeenCalledWith(error, {
      tags: { route: "/articles/[slug]", routeType: "render" },
      extra: { path: "/articles/a", method: "GET" },
    })
  })

  it("leaves starting the SDK to worker.mjs", () => {
    expect(init()).toBeUndefined()
  })
})
