import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { commentThread, commentViewer } from "@/stories/fixtures/comments"

import { Comments } from ".."

/** An observer that reports the element in view at once. */
class InViewObserver {
  constructor(private callback: IntersectionObserverCallback) {}
  observe() {
    this.callback(
      [{ isIntersecting: true } as IntersectionObserverEntry],
      this as unknown as IntersectionObserver,
    )
  }
  disconnect = vi.fn()
  unobserve = vi.fn()
}

const fetchMock = vi.fn<typeof fetch>()
const signedIn = commentThread({ viewer: commentViewer, providers: [] })

const posted = (body: string, overrides: Record<string, unknown> = {}) =>
  Response.json(
    {
      comment: {
        id: 9,
        parentId: null,
        depth: 0,
        body,
        createdAt: new Date().toISOString(),
        author: { name: "Ada Reader", image: null, badge: null },
        ...overrides,
      },
    },
    { status: 201 },
  )

beforeEach(() => {
  vi.stubGlobal("IntersectionObserver", InViewObserver)
  vi.stubGlobal("fetch", fetchMock)
  fetchMock.mockReset()
})

afterEach(() => {
  vi.unstubAllGlobals()
  window.history.replaceState(null, "", "/")
})

describe("Comments", () => {
  it("loads the article's thread once it's in view, nesting replies", async () => {
    fetchMock.mockResolvedValue(Response.json(commentThread()))

    render(<Comments articleId={7} />)

    expect(await screen.findAllByRole("article", { name: "Comment by Ada Reader" })).toHaveLength(2)
    expect(fetchMock).toHaveBeenCalledWith("/api/comments/thread/7", {
      credentials: "same-origin",
    })
    // The reply sits in the list under its parent's item.
    const reply = screen.getByText(/second chart's source/)
    expect(reply.closest("ol")?.closest("li")).toHaveTextContent("zoning reform")
    expect(screen.getByText("Staff")).toBeInTheDocument()
    expect(screen.getByText("This comment was removed.")).toBeInTheDocument()
    // Placeholders don't count.
    expect(screen.getByRole("heading", { name: "Comments (3)" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Sign in with Discord" })).toBeInTheDocument()
  })

  it("posts a comment and adds it to the list", async () => {
    fetchMock.mockResolvedValueOnce(Response.json(signedIn)).mockResolvedValueOnce(posted("Hi"))

    render(<Comments articleId={7} />)
    const box = await screen.findByRole("textbox", { name: /Commenting as Ada Reader/ })
    fireEvent.change(box, { target: { value: "Hi" } })
    fireEvent.click(screen.getByRole("button", { name: "Post comment" }))

    expect(await screen.findByText("Hi")).toBeInTheDocument()
    expect(box).toHaveValue("")
    const [url, init] = fetchMock.mock.calls[1]!
    expect(url).toBe("/api/comments/thread/7")
    expect(init).toMatchObject({ method: "POST", body: JSON.stringify({ body: "Hi" }) })
  })

  it("replies under a comment", async () => {
    fetchMock
      .mockResolvedValueOnce(Response.json(signedIn))
      .mockResolvedValueOnce(posted("Me too", { parentId: 2, depth: 2 }))

    render(<Comments articleId={7} />)
    const replyButtons = await screen.findAllByRole("button", { name: "Reply" })
    fireEvent.click(replyButtons[1]!)
    const box = screen.getByRole("textbox", { name: "Reply to Grace Hopper" })
    fireEvent.change(box, { target: { value: "Me too" } })
    fireEvent.click(screen.getByRole("button", { name: "Post reply" }))

    // The box closes once the reply is in; until then its own text would match.
    await waitFor(() =>
      expect(
        screen.queryByRole("textbox", { name: "Reply to Grace Hopper" }),
      ).not.toBeInTheDocument(),
    )
    const reply = screen.getByText("Me too")
    expect(reply.closest("ol")?.closest("li")).toHaveTextContent(/second chart's source/)
    expect(JSON.parse(String(fetchMock.mock.calls[1]![1]?.body))).toEqual({
      body: "Me too",
      parentId: 2,
    })
  })

  it("says where replies stop instead of offering one", async () => {
    fetchMock.mockResolvedValue(Response.json({ ...signedIn, maxDepth: 1 }))

    render(<Comments articleId={7} />)

    await screen.findByRole("textbox", { name: /Commenting as/ })
    expect(screen.getAllByText("Replies are limited to 1 levels here.")).toHaveLength(2)
    // The two top-level comments still take replies; the removed one doesn't.
    expect(screen.getAllByRole("button", { name: "Reply" })).toHaveLength(1)
  })

  it("tells the author when a check held their comment", async () => {
    fetchMock.mockResolvedValueOnce(Response.json(signedIn)).mockResolvedValueOnce(
      Response.json(
        {
          comment: { ...(await posted("x").json()).comment, body: "Spam?", held: true },
          held: "More than 2 links",
        },
        { status: 201 },
      ),
    )

    render(<Comments articleId={7} />)
    const box = await screen.findByRole("textbox", { name: /Commenting as/ })
    fireEvent.change(box, { target: { value: "Spam?" } })
    fireEvent.click(screen.getByRole("button", { name: "Post comment" }))

    expect(await screen.findByRole("status")).toHaveTextContent("(more than 2 links)")
    const held = screen.getByText("Spam?").closest("article")!
    expect(within(held).getByText(/Only you can see this/)).toBeInTheDocument()
  })

  it("tells a locked account when it can comment again", async () => {
    fetchMock.mockResolvedValue(
      Response.json({
        ...signedIn,
        viewer: { ...commentViewer, locked: { until: "2026-11-01T00:00:00.000Z" } },
      }),
    )

    render(<Comments articleId={7} />)

    expect(await screen.findByText(/can't comment until/)).toBeInTheDocument()
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Reply" })).not.toBeInTheDocument()
  })

  it("shows why a post was refused, and keeps what was written", async () => {
    fetchMock
      .mockResolvedValueOnce(Response.json(signedIn))
      .mockResolvedValueOnce(Response.json({ message: "Give it a few seconds." }, { status: 429 }))

    render(<Comments articleId={7} />)
    const box = await screen.findByRole("textbox", { name: /Commenting as/ })
    fireEvent.change(box, { target: { value: "Again" } })
    fireEvent.click(screen.getByRole("button", { name: "Post comment" }))

    expect(await screen.findByRole("alert")).toHaveTextContent("Give it a few seconds.")
    expect(box).toHaveValue("Again")
  })

  it("explains a sign-in a provider sent back with an error", async () => {
    window.history.replaceState(null, "", "/articles/x?error=unable_to_create_user")
    fetchMock.mockResolvedValue(Response.json(commentThread()))

    render(<Comments articleId={7} />)

    expect(await screen.findByRole("alert")).toHaveTextContent("couldn't make an account")
  })

  it("starts a sign-in that may make an account, and returns to the comments", async () => {
    fetchMock
      .mockResolvedValueOnce(Response.json(commentThread()))
      .mockResolvedValueOnce(Response.json({ message: "nope" }, { status: 500 }))
    window.history.replaceState(null, "", "/articles/x")

    render(<Comments articleId={7} />)
    fireEvent.click(await screen.findByRole("button", { name: "Sign in with Discord" }))

    expect(await screen.findByRole("alert")).toHaveTextContent("Sign-in didn't complete")
    const [url, init] = fetchMock.mock.calls[1]!
    expect(url).toBe("/api/auth/sign-in/social")
    expect(JSON.parse(String(init?.body))).toEqual({
      provider: "discord",
      requestSignUp: true,
      callbackURL: "/articles/x#comments",
      errorCallbackURL: "/articles/x",
    })
  })

  it("offers to try again when the thread doesn't load", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response("", { status: 500 }))
      .mockResolvedValueOnce(Response.json(commentThread()))

    render(<Comments articleId={7} />)
    fireEvent.click(await screen.findByRole("button", { name: "Try again" }))

    expect(await screen.findByText(/zoning reform/)).toBeInTheDocument()
  })
})
