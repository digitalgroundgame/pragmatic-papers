import { cleanup, render } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const { auth } = vi.hoisted(() => ({ auth: { user: null as unknown } }))

vi.mock("@payloadcms/ui", () => ({
  useAuth: () => auth,
  useConfig: () => ({ config: { routes: { admin: "/admin" } } }),
}))

import { ResumeSession } from "../ResumeSession"

const replace = vi.fn()
const realLocation = window.location

function visit(search: string) {
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { search, replace },
  })
}

beforeEach(() => {
  replace.mockClear()
  visit("")
})

afterEach(() => {
  cleanup()
  Object.defineProperty(window, "location", { configurable: true, value: realLocation })
})

describe("ResumeSession", () => {
  it("leaves the login page alone while nobody is signed in", () => {
    auth.user = null
    render(<ResumeSession />)
    expect(replace).not.toHaveBeenCalled()
  })

  it("sends someone already signed in to the admin", () => {
    auth.user = { id: 1 }
    render(<ResumeSession />)
    expect(replace).toHaveBeenCalledWith("/admin")
  })

  it("sends them where they were headed", () => {
    auth.user = { id: 1 }
    visit("?redirect=%2Fadmin%2Fcollections%2Farticles")
    render(<ResumeSession />)
    expect(replace).toHaveBeenCalledWith("/admin/collections/articles")
  })

  it("goes once the admin has found the user, not before", () => {
    auth.user = null
    const { rerender } = render(<ResumeSession />)
    expect(replace).not.toHaveBeenCalled()

    auth.user = { id: 1 }
    rerender(<ResumeSession />)
    expect(replace).toHaveBeenCalledTimes(1)
  })

  it.each(["//example.com", "https://example.com/", "/\\example.com"])(
    "never leaves the site: %s",
    (redirect) => {
      auth.user = { id: 1 }
      visit(`?redirect=${encodeURIComponent(redirect)}`)
      render(<ResumeSession />)
      expect(replace).toHaveBeenCalledWith("/admin")
    },
  )
})
