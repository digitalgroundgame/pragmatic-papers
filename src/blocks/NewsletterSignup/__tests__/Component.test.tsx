import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { NewsletterSignupBlock as NewsletterSignupTypes } from "@/payload-types"

// `next/script` would otherwise try to load the Turnstile script from the
// network. Replace it with a stub that records the load and synchronously fires
// `onReady` after mount so the widget-initialization effect runs in tests.
const scriptLoads = vi.hoisted(() => [] as string[])
vi.mock("next/script", async () => {
  const React = await import("react")
  const ScriptMock = ({ src, onReady }: { src: string; onReady?: () => void }) => {
    React.useEffect(() => {
      scriptLoads.push(src)
      onReady?.()
      // eslint-disable-next-line react-hooks/exhaustive-deps -- once per script, like next/script
    }, [src])
    return null
  }
  return { default: ScriptMock }
})

// The site key comes in as a prop (the server reads it with getTurnstileSiteKey), so
// each suite binds one: "" leaves the widget out.
async function importComponent(siteKey: string): Promise<React.FC<Partial<NewsletterSignupTypes>>> {
  const { NewsletterSignupBlock } = await import("../Component")
  const WithSiteKey: React.FC<Partial<NewsletterSignupTypes>> = (props) => (
    <NewsletterSignupBlock
      {...(props as NewsletterSignupTypes)}
      turnstileSiteKey={siteKey || undefined}
    />
  )
  return WithSiteKey
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

  interface RenderOptions {
    sitekey: string
    appearance?: string
    callback: (token: string) => void
    "error-callback"?: () => void
  }

  /** A fake `window.turnstile` whose widget hands over its token when `issue` is called. */
  function stubTurnstile(options: { issueOnRender?: boolean } = {}) {
    const rendered: RenderOptions[] = []
    const api = {
      render: vi.fn((_el: HTMLElement, opts: RenderOptions) => {
        rendered.push(opts)
        if (options.issueOnRender) opts.callback("captcha-token")
        return "widget-1"
      }),
      reset: vi.fn(),
      remove: vi.fn(),
    }
    ;(window as { turnstile?: unknown }).turnstile = api
    return {
      api,
      rendered,
      issue: (token = "captcha-token") => act(() => rendered.at(-1)?.callback(token)),
      fail: () => act(() => rendered.at(-1)?.["error-callback"]?.()),
    }
  }

  function engage(): void {
    fireEvent.focus(screen.getByLabelText("Email address"))
  }

  beforeEach(() => {
    scriptLoads.length = 0
  })

  afterEach(() => {
    delete (window as { turnstile?: unknown }).turnstile
  })

  it("doesn't load Turnstile until the reader engages with the form", async () => {
    const turnstile = stubTurnstile()
    const NewsletterSignupBlock = await importComponent(SITE_KEY)
    render(<NewsletterSignupBlock />)

    expect(scriptLoads).toEqual([])
    expect(turnstile.api.render).not.toHaveBeenCalled()

    engage()

    await waitFor(() => expect(turnstile.api.render).toHaveBeenCalledTimes(1))
    expect(scriptLoads).toEqual([
      "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit",
    ])
  })

  it("doesn't start the challenge when the pointer only passes over the form", async () => {
    const turnstile = stubTurnstile()
    const NewsletterSignupBlock = await importComponent(SITE_KEY)
    const { container } = render(<NewsletterSignupBlock />)

    fireEvent.pointerEnter(container.firstElementChild as HTMLElement)
    fireEvent.pointerOver(screen.getByLabelText("Email address"))

    expect(scriptLoads).toEqual([])
    expect(turnstile.api.render).not.toHaveBeenCalled()
  })

  it("renders the widget only when Cloudflare asks the reader to interact", async () => {
    const turnstile = stubTurnstile()
    const NewsletterSignupBlock = await importComponent(SITE_KEY)
    render(<NewsletterSignupBlock />)
    engage()

    await waitFor(() => expect(turnstile.rendered).toHaveLength(1))
    expect(turnstile.rendered[0]).toMatchObject({
      sitekey: SITE_KEY,
      appearance: "interaction-only",
    })
  })

  it("leaves the button enabled before a token arrives", async () => {
    stubTurnstile()
    const NewsletterSignupBlock = await importComponent(SITE_KEY)
    render(<NewsletterSignupBlock />)

    expect(screen.getByRole("button", { name: "Sign Up" })).toBeEnabled()
  })

  it("holds a submit that beats the token, then sends it with the token", async () => {
    const turnstile = stubTurnstile()
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
    vi.stubGlobal("fetch", fetchMock)

    const NewsletterSignupBlock = await importComponent(SITE_KEY)
    render(<NewsletterSignupBlock />)

    typeEmail("reader@example.com")
    fireEvent.submit(getForm())

    const button = screen.getByRole("button")
    await waitFor(() => expect(button).toHaveTextContent("Verifying…"))
    expect(button).toBeDisabled()
    expect(fetchMock).not.toHaveBeenCalled()

    await waitFor(() => expect(turnstile.rendered).toHaveLength(1))
    turnstile.issue()

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/newsletter/subscribe",
        expect.objectContaining({
          body: JSON.stringify({ email: "reader@example.com", turnstileToken: "captcha-token" }),
        }),
      ),
    )
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(
      await screen.findByText("Check your inbox to confirm your subscription."),
    ).toBeInTheDocument()
  })

  it("sends straight away when the token is already there", async () => {
    stubTurnstile({ issueOnRender: true })
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
    vi.stubGlobal("fetch", fetchMock)

    const NewsletterSignupBlock = await importComponent(SITE_KEY)
    render(<NewsletterSignupBlock />)
    engage()
    typeEmail("reader@example.com")
    await waitFor(() => expect(window.turnstile?.render).toHaveBeenCalled())

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

  it("shows an error when the challenge fails while a submit waits on it", async () => {
    const turnstile = stubTurnstile()
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)

    const NewsletterSignupBlock = await importComponent(SITE_KEY)
    render(<NewsletterSignupBlock />)
    typeEmail("reader@example.com")
    fireEvent.submit(getForm())
    await waitFor(() => expect(turnstile.rendered).toHaveLength(1))

    turnstile.fail()

    const alert = await screen.findByRole("alert")
    expect(alert).toHaveTextContent("We couldn't check that you're human. Please try again.")
    expect(screen.getByRole("button", { name: "Sign Up" })).toBeEnabled()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("resets the Turnstile widget after a failed submission", async () => {
    const turnstile = stubTurnstile({ issueOnRender: true })
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: "nope" }) }),
    )

    const NewsletterSignupBlock = await importComponent(SITE_KEY)
    render(<NewsletterSignupBlock />)
    engage()
    await waitFor(() => expect(turnstile.api.render).toHaveBeenCalled())

    typeEmail("reader@example.com")
    fireEvent.submit(getForm())

    await waitFor(() => expect(turnstile.api.reset).toHaveBeenCalledWith("widget-1"))
  })
})
