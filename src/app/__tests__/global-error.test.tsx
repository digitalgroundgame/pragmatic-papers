import { render } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

const { captureException } = vi.hoisted(() => ({ captureException: vi.fn() }))

vi.mock("@/sentryClient", () => ({ captureException }))
// Next's error page renders its own <html>; this is about what GlobalError reports.
vi.mock("next/error", () => ({ default: () => <p>Something went wrong</p> }))

import GlobalError from "../global-error"

describe("GlobalError", () => {
  it("reports the error that took the root layout down, once, as unhandled", () => {
    const error = Object.assign(new Error("layout threw"), { digest: "abc" })
    const { rerender } = render(<GlobalError error={error} />, { container: document })
    expect(captureException).toHaveBeenCalledExactlyOnceWith(error, {
      mechanism: { handled: false, type: "auto.function.nextjs.global_error" },
    })

    rerender(<GlobalError error={error} />)
    expect(captureException).toHaveBeenCalledTimes(1)
  })
})
