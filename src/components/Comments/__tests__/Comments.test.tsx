import { fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { CommentThread } from "@/plugins/comments"

import { Comments } from ".."

const thread: CommentThread = {
  comments: [
    {
      id: 1,
      body: "First",
      createdAt: "2026-10-01T12:00:00.000Z",
      author: { name: "Ada Reader", image: null },
    },
  ],
  viewer: { name: "Ada Reader", image: null, banned: false },
  providers: ["discord"],
  maxLength: 2000,
}

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
  it("loads the article's thread once it's in view", async () => {
    fetchMock.mockResolvedValue(Response.json({ ...thread, viewer: null }))

    render(<Comments articleId={7} />)

    expect(await screen.findByText("First")).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith("/api/comments/thread/7", {
      credentials: "same-origin",
    })
    expect(screen.getByRole("button", { name: "Sign in with Discord" })).toBeInTheDocument()
  })

  it("posts a comment and adds it to the list", async () => {
    fetchMock.mockResolvedValueOnce(Response.json(thread)).mockResolvedValueOnce(
      Response.json(
        {
          comment: {
            id: 2,
            body: "Second",
            createdAt: new Date().toISOString(),
            author: { name: "Ada Reader", image: null },
          },
        },
        { status: 201 },
      ),
    )

    render(<Comments articleId={7} />)
    const box = await screen.findByRole("textbox")
    fireEvent.change(box, { target: { value: "Second" } })
    fireEvent.click(screen.getByRole("button", { name: "Post comment" }))

    expect(await screen.findByText("Second")).toBeInTheDocument()
    expect(box).toHaveValue("")
    const [url, init] = fetchMock.mock.calls[1]!
    expect(url).toBe("/api/comments/thread/7")
    expect(init).toMatchObject({ method: "POST", body: JSON.stringify({ body: "Second" }) })
  })

  it("shows why a post was refused, and keeps what the reader wrote", async () => {
    fetchMock
      .mockResolvedValueOnce(Response.json(thread))
      .mockResolvedValueOnce(Response.json({ message: "Give it a few seconds." }, { status: 429 }))

    render(<Comments articleId={7} />)
    const box = await screen.findByRole("textbox")
    fireEvent.change(box, { target: { value: "Again" } })
    fireEvent.click(screen.getByRole("button", { name: "Post comment" }))

    expect(await screen.findByRole("alert")).toHaveTextContent("Give it a few seconds.")
    expect(box).toHaveValue("Again")
  })

  it("explains a sign-in a provider sent back with an error", async () => {
    window.history.replaceState(null, "", "/articles/x?error=email_not_found")
    fetchMock.mockResolvedValue(Response.json({ ...thread, viewer: null }))

    render(<Comments articleId={7} />)

    expect(await screen.findByRole("alert")).toHaveTextContent("didn't share an email address")
  })

  it("starts a provider sign-in that returns to the comments", async () => {
    fetchMock
      .mockResolvedValueOnce(Response.json({ ...thread, viewer: null }))
      .mockResolvedValueOnce(Response.json({ message: "nope" }, { status: 500 }))
    window.history.replaceState(null, "", "/articles/x")

    render(<Comments articleId={7} />)
    fireEvent.click(await screen.findByRole("button", { name: "Sign in with Discord" }))

    expect(await screen.findByRole("alert")).toHaveTextContent("Sign-in didn't complete")
    const [url, init] = fetchMock.mock.calls[1]!
    expect(url).toBe("/api/reader-auth/sign-in/social")
    expect(JSON.parse(String(init?.body))).toEqual({
      provider: "discord",
      callbackURL: "/articles/x#comments",
      errorCallbackURL: "/articles/x",
    })
  })

  it("offers to try again when the thread doesn't load", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response("", { status: 500 }))
      .mockResolvedValueOnce(Response.json(thread))

    render(<Comments articleId={7} />)
    fireEvent.click(await screen.findByRole("button", { name: "Try again" }))

    expect(await screen.findByText("First")).toBeInTheDocument()
  })
})
