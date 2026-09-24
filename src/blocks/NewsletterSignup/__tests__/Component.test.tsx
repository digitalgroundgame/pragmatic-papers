import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { NewsletterSignupBlock as NewsletterSignupTypes } from "@/payload-types"

// `next/script` would otherwise try to load the Turnstile script from the
// network. Replace it with a stub that synchronously fires `onReady` after
// mount so the widget-initialization effect runs in tests.
vi.mock("next/script", async () => {
  const React = await import("react")
  const ScriptMock = ({ onReady }: { onReady?: () => void }) => {
    React.useEffect(() => {
      onReady?.()
    }, [onReady])
    return null
  }
  return { default: ScriptMock }
})

// The component reads NEXT_PUBLIC_TURNSTILE_SITE_KEY at module-eval time, so
// each suite stubs the env and imports a fresh copy of the component.
async function importComponent(siteKey: string): Promise<React.FC<Partial<NewsletterSignupTypes>>> {
  vi.resetModules()
  vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", siteKey)
  const mod = await import("../Component")
  return mod.NewsletterSignupBlock as React.FC<Partial<NewsletterSignupTypes>>
}

function getForm(): HTMLFormElement {
  const form = document.querySelector("form")
  if (!form) throw new Error("form not found")
  return form
}

function typeEmail(value: string): void {
  const input = screen.getByLabelText("Email address")
  fireEvent.change(input, { target: { value } })
}

afterEach(() => {
  cleanup()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe("NewsletterSignupBlock (no Turnstile)", () => {
  let NewsletterSignupBlock: React.FC<Partial<NewsletterSignupTypes>>

  beforeEach(async () => {
    NewsletterSignupBlock = await importComponent("")
  })

  it("renders the default heading and button label when no props are given", () => {
    render(<NewsletterSignupBlock />)

    expect(screen.getByRole("heading").textContent).toBe("Get Daily Pragmatic Papers")
    expect(screen.getByRole("button", { name: "Sign Up" })).toBeInTheDocument()
  })

  // `fireEvent.change` writes the value in one shot, so it walks straight past
  // `maxLength`. Until the suite has user-event to type character by character,
  // assert the cap is wired to the input at all.
  it("caps the email field at the RFC 5321 address length", () => {
    render(<NewsletterSignupBlock />)

    expect(screen.getByLabelText("Email address")).toHaveAttribute("maxLength", "254")
  })

  it("renders the provided heading, description, and button label", () => {
    render(
      <NewsletterSignupBlock
        heading="Custom heading"
        description="A short blurb"
        buttonLabel="Join now"
      />,
    )

    expect(screen.getByRole("heading").textContent).toBe("Custom heading")
    expect(screen.getByText("A short blurb")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Join now" })).toBeInTheDocument()
  })

  it("submits the email and shows the success message on a 2xx response", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    })
    vi.stubGlobal("fetch", fetchMock)

    render(<NewsletterSignupBlock />)
    typeEmail("reader@example.com")
    fireEvent.submit(getForm())

    expect(
      await screen.findByText("Check your inbox to confirm your subscription."),
    ).toBeInTheDocument()

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/newsletter/subscribe",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "reader@example.com", turnstileToken: null }),
      }),
    )
    // Input is cleared after a successful subscription.
    expect((screen.getByLabelText("Email address") as HTMLInputElement).value).toBe("")
  })

  it("shows the server-provided error message on a non-2xx response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: "Already subscribed" }),
      }),
    )

    render(<NewsletterSignupBlock />)
    typeEmail("reader@example.com")
    fireEvent.submit(getForm())

    const alert = await screen.findByRole("alert")
    expect(alert.textContent).toBe("Already subscribed")
  })

  it("falls back to a generic message when the error response has no body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => {
          throw new Error("no body")
        },
      }),
    )

    render(<NewsletterSignupBlock />)
    typeEmail("reader@example.com")
    fireEvent.submit(getForm())

    const alert = await screen.findByRole("alert")
    expect(alert.textContent).toBe("Something went wrong. Please try again.")
  })

  it("shows a network error message when the request rejects", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")))

    render(<NewsletterSignupBlock />)
    typeEmail("reader@example.com")
    fireEvent.submit(getForm())

    const alert = await screen.findByRole("alert")
    expect(alert.textContent).toBe("Network error. Please try again.")
  })

  it("disables the input and button while the request is in flight", async () => {
    let resolveFetch!: (value: unknown) => void
    const pending = new Promise((resolve) => {
      resolveFetch = resolve
    })
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(pending))

    render(<NewsletterSignupBlock />)
    typeEmail("reader@example.com")
    fireEvent.submit(getForm())

    const button = screen.getByRole("button")
    await waitFor(() => expect(button.textContent).toBe("Subscribing…"))
    expect(button).toBeDisabled()
    expect(screen.getByLabelText("Email address")).toBeDisabled()

    resolveFetch({ ok: true, json: async () => ({}) })
    expect(
      await screen.findByText("Check your inbox to confirm your subscription."),
    ).toBeInTheDocument()
  })
})

describe("NewsletterSignupBlock (with Turnstile)", () => {
  const SITE_KEY = "test-site-key"

  afterEach(() => {
    delete (window as { turnstile?: unknown }).turnstile
  })

  it("keeps the submit button disabled until a Turnstile token is issued", async () => {
    // No window.turnstile means the widget never renders a token.
    const NewsletterSignupBlock = await importComponent(SITE_KEY)
    render(<NewsletterSignupBlock />)

    expect(screen.getByRole("button")).toBeDisabled()
  })

  it("enables submission and includes the token once the widget issues one", async () => {
    const reset = vi.fn()
    ;(window as { turnstile?: unknown }).turnstile = {
      render: (_el: HTMLElement, opts: { callback: (token: string) => void }) => {
        opts.callback("captcha-token")
        return "widget-1"
      },
      reset,
      remove: vi.fn(),
    }

    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
    vi.stubGlobal("fetch", fetchMock)

    const NewsletterSignupBlock = await importComponent(SITE_KEY)
    render(<NewsletterSignupBlock />)

    const button = screen.getByRole("button")
    await waitFor(() => expect(button).not.toBeDisabled())

    typeEmail("reader@example.com")
    fireEvent.submit(getForm())

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/newsletter/subscribe",
        expect.objectContaining({
          body: JSON.stringify({ email: "reader@example.com", turnstileToken: "captcha-token" }),
        }),
      ),
    )
  })

  it("resets the Turnstile widget after a failed submission", async () => {
    const reset = vi.fn()
    ;(window as { turnstile?: unknown }).turnstile = {
      render: (_el: HTMLElement, opts: { callback: (token: string) => void }) => {
        opts.callback("captcha-token")
        return "widget-1"
      },
      reset,
      remove: vi.fn(),
    }

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: "nope" }) }),
    )

    const NewsletterSignupBlock = await importComponent(SITE_KEY)
    render(<NewsletterSignupBlock />)

    const button = screen.getByRole("button")
    await waitFor(() => expect(button).not.toBeDisabled())

    typeEmail("reader@example.com")
    fireEvent.submit(getForm())

    await waitFor(() => expect(reset).toHaveBeenCalled())
  })
})
