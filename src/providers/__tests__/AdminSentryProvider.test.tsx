import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { AdminSentryProvider } from "../AdminSentryProvider"

const { setUser, auth } = vi.hoisted(() => ({
  setUser: vi.fn(),
  auth: { user: null as null | { id: number; email?: string | null; collection: string } },
}))

vi.mock("@/sentryClient", () => ({ setUser }))
vi.mock("@payloadcms/ui", () => ({ useAuth: () => auth }))

beforeEach(() => {
  setUser.mockClear()
  auth.user = null
})

describe("AdminSentryProvider", () => {
  it("renders the admin and attaches the signed-in user, as the plugin does on the server", () => {
    auth.user = { id: 7, email: "editor@example.com", collection: "users" }
    render(
      <AdminSentryProvider>
        <p>Dashboard</p>
      </AdminSentryProvider>,
    )

    expect(screen.getByText("Dashboard")).toBeInTheDocument()
    expect(setUser).toHaveBeenCalledExactlyOnceWith({
      id: "7",
      email: "editor@example.com",
      collection: "users",
    })
  })

  it("clears the user when nobody is signed in, and follows a sign-in", () => {
    const { rerender } = render(<AdminSentryProvider />)
    expect(setUser).toHaveBeenLastCalledWith(null)

    auth.user = { id: 3, email: null, collection: "users" }
    rerender(<AdminSentryProvider />)
    expect(setUser).toHaveBeenLastCalledWith({ id: "3", email: undefined, collection: "users" })
  })
})
