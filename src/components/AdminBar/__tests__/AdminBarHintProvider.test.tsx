import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

const { auth } = vi.hoisted(() => ({ auth: { user: null as unknown } }))

vi.mock("@payloadcms/ui", () => ({ useAuth: () => auth }))

import { AdminBarHintProvider } from "../AdminBarHintProvider"
import { ADMIN_BAR_HINT_KEY } from "../hint"

afterEach(() => {
  cleanup()
  localStorage.clear()
})

describe("AdminBarHintProvider", () => {
  it("sets the hint while someone is logged in to the admin panel", () => {
    auth.user = { id: 1 }
    render(<AdminBarHintProvider>panel</AdminBarHintProvider>)
    expect(screen.getByText("panel")).toBeInTheDocument()
    expect(localStorage.getItem(ADMIN_BAR_HINT_KEY)).toBe("1")
  })

  it("clears it on the login page", () => {
    localStorage.setItem(ADMIN_BAR_HINT_KEY, "1")
    auth.user = null
    render(<AdminBarHintProvider>login</AdminBarHintProvider>)
    expect(localStorage.getItem(ADMIN_BAR_HINT_KEY)).toBeNull()
  })
})
