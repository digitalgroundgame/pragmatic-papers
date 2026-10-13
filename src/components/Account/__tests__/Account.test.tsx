import { fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { Account } from ".."

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

const fetchMock = vi.fn<typeof fetch>()
const providers = [{ id: "discord", label: "Discord" }]
const member = { name: "Ada", email: "ada@example.com", managedInAdmin: false }

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock)
  fetchMock.mockReset()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

/** Answers each request by its URL and method. */
function route(handlers: Record<string, () => Response>) {
  fetchMock.mockImplementation(async (input, init) => {
    const key = `${init?.method ?? "GET"} ${String(input)}`
    const handler = handlers[key]
    if (!handler) throw new Error(`unexpected ${key}`)
    return handler()
  })
}

describe("Account", () => {
  it("offers a sign-in that may make an account, to someone signed out", async () => {
    route({
      "GET /api/account": () => Response.json({}, { status: 401 }),
      "POST /api/auth/sign-in/social": () => Response.json({}, { status: 500 }),
    })

    render(<Account providers={providers} />)
    fireEvent.click(await screen.findByRole("button", { name: "Sign in with Discord" }))

    expect(await screen.findByRole("alert")).toHaveTextContent("Sign-in didn't complete")
    expect(JSON.parse(String(fetchMock.mock.calls[1]![1]?.body))).toMatchObject({
      provider: "discord",
      requestSignUp: true,
      callbackURL: "/account",
    })
  })

  it("renames a member", async () => {
    route({
      "GET /api/account": () => Response.json(member),
      "GET /api/auth-links": () => Response.json({ providers: [] }),
      "PATCH /api/account": () => Response.json({ ...member, name: "Ada L." }),
    })

    render(<Account providers={providers} />)
    const name = await screen.findByRole("textbox", { name: "Display name" })
    fireEvent.change(name, { target: { value: "Ada L." } })
    fireEvent.click(screen.getByRole("button", { name: "Save" }))

    expect(await screen.findByRole("status")).toHaveTextContent("Saved.")
    expect(screen.getByText("Ada L.", { selector: "span" })).toBeInTheDocument()
  })

  it("shows why a name wasn't saved", async () => {
    route({
      "GET /api/account": () => Response.json(member),
      "GET /api/auth-links": () => Response.json({ providers: [] }),
      "PATCH /api/account": () => Response.json({ message: "Too long." }, { status: 400 }),
    })

    render(<Account providers={providers} />)
    const name = await screen.findByRole("textbox", { name: "Display name" })
    fireEvent.change(name, { target: { value: "x".repeat(10) } })
    fireEvent.click(screen.getByRole("button", { name: "Save" }))

    expect(await screen.findByRole("alert")).toHaveTextContent("Too long.")
  })

  it("asks before deleting, and says when it didn't work", async () => {
    route({
      "GET /api/account": () => Response.json(member),
      "GET /api/auth-links": () => Response.json({ providers: [] }),
      "DELETE /api/account": () => Response.json({}, { status: 500 }),
    })

    render(<Account providers={providers} />)
    fireEvent.click(await screen.findByRole("button", { name: "Delete account" }))
    expect(fetchMock).not.toHaveBeenCalledWith(
      "/api/account",
      expect.objectContaining({ method: "DELETE" }),
    )
    fireEvent.click(screen.getByRole("button", { name: "Yes, delete my account" }))

    expect(await screen.findByRole("alert")).toHaveTextContent("wasn't deleted")
  })

  it("signs out", async () => {
    route({
      "GET /api/account": () => Response.json(member),
      "GET /api/auth-links": () => Response.json({ providers: [] }),
      "POST /api/auth/sign-out": () => Response.json({ success: true }),
    })

    render(<Account providers={providers} />)
    fireEvent.click(await screen.findByRole("button", { name: "Sign out" }))

    expect(await screen.findByText(/not signed in/)).toBeInTheDocument()
  })

  it("disconnects a sign-in, refusing the last", async () => {
    let linked = [
      { id: "google", label: "Google", linked: true },
      { id: "discord", label: "Discord", linked: true },
    ]
    route({
      "GET /api/account": () => Response.json(member),
      "GET /api/auth-links": () => Response.json({ providers: linked }),
      "DELETE /api/auth-links/google": () => {
        linked = linked.map((p) => (p.id === "google" ? { ...p, linked: false } : p))
        return Response.json({ ok: true })
      },
    })

    render(<Account providers={providers} />)
    fireEvent.click(await screen.findByRole("button", { name: "Disconnect Google" }))

    expect(await screen.findByRole("button", { name: "Connect Google" })).toBeEnabled()
    expect(screen.getByRole("button", { name: "Disconnect Discord" })).toBeDisabled()
  })
})
