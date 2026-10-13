import { act, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { SignInButtons } from "../components/SignInButtons"

let search = ""
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(search) }))

const fetchMock = vi.fn<typeof fetch>()
const assign = vi.fn()

const renderButtons = () =>
  render(
    <SignInButtons providers={["google", "discord"]} authPath="/api/auth" adminPath="/admin" />,
  )

beforeEach(() => {
  search = ""
  vi.stubGlobal("fetch", fetchMock)
  vi.stubGlobal("location", { ...window.location, assign })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe("SignInButtons", () => {
  it("starts the provider's sign-in and follows its redirect", async () => {
    fetchMock.mockResolvedValue(Response.json({ url: "https://accounts.google.com/o/oauth2" }))
    renderButtons()

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Sign in with Google" }))
    })

    expect(fetchMock).toHaveBeenCalledWith("/api/auth/sign-in/social", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: "google",
        callbackURL: "/admin",
        errorCallbackURL: "/admin/login",
      }),
    })
    expect(assign).toHaveBeenCalledWith("https://accounts.google.com/o/oauth2")
  })

  it("disables both buttons while it redirects", async () => {
    // A sign-in that hasn't answered yet.
    fetchMock.mockReturnValue(new Promise<Response>(() => undefined))
    renderButtons()

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Sign in with Discord" }))
    })

    expect(screen.getByRole("button", { name: "Redirecting…" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Sign in with Google" })).toBeDisabled()
  })

  it.each([
    ["the request fails", () => fetchMock.mockRejectedValue(new TypeError("offline"))],
    ["no redirect comes back", () => fetchMock.mockResolvedValue(Response.json({}))],
    [
      "Better Auth refuses",
      () => fetchMock.mockResolvedValue(Response.json({ url: "x" }, { status: 400 })),
    ],
  ])("says so, and re-enables the buttons, when %s", async (_name, arrange) => {
    arrange()
    renderButtons()

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Sign in with Google" }))
    })

    expect(screen.getByRole("alert")).toHaveTextContent("Sign-in didn't complete")
    expect(screen.getByRole("button", { name: "Sign in with Google" })).toBeEnabled()
    expect(assign).not.toHaveBeenCalled()
  })

  it.each([
    ["signup_disabled", "No account here uses that address"],
    ["account_not_linked", "hasn't verified your email address"],
    ["email_not_found", "That account isn't linked to anyone here"],
    ["something_else", "Sign-in didn't complete"],
  ])("explains ?error=%s", (code, message) => {
    search = `error=${code}`
    renderButtons()
    expect(screen.getByRole("alert")).toHaveTextContent(message)
  })

  it("shows no error on a plain visit", () => {
    renderButtons()
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })
})
