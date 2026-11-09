import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@next/third-parties/google", () => ({ sendGAEvent: vi.fn() }))

// The real menu is Base UI's select; a native one is enough to pick an order here.
vi.mock("../SortMenu.lazy", () => ({
  SortMenu: ({ value, onChange }: { value: string; onChange: (sort: string) => void }) => (
    <select aria-label="Sort comments" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="random">Random</option>
      <option value="new">New</option>
      <option value="old">Old</option>
    </select>
  ),
}))

import { sendGAEvent } from "@next/third-parties/google"

import { commentThread, commentViewer } from "@/stories/fixtures/comments"

import { Comments } from ".."
import { SEED_KEY, SORT_KEY } from "../useCommentOrder"

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
  vi.mocked(sendGAEvent).mockClear()
  // Oldest first, so tests can count on where each comment is.
  window.localStorage.setItem(SORT_KEY, "old")
})

afterEach(() => {
  vi.unstubAllGlobals()
  window.history.replaceState(null, "", "/")
  window.localStorage.removeItem(SORT_KEY)
  window.localStorage.removeItem(SEED_KEY)
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
      callbackURL: "/articles/x?signed_in=discord#comments",
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

  it("folds a comment and its replies into one row, and opens it again", async () => {
    fetchMock.mockResolvedValue(Response.json(commentThread()))

    render(<Comments articleId={7} />)
    const [collapse] = await screen.findAllByRole("button", {
      name: "Collapse Ada Reader's comment",
    })
    expect(collapse).toHaveAttribute("aria-expanded", "true")
    fireEvent.click(collapse!)

    const expand = screen.getByRole("button", { name: "Expand Ada Reader's comment" })
    expect(expand).toHaveAttribute("aria-expanded", "false")
    expect(expand).toHaveFocus()
    expect(screen.getByText("(1 reply)")).toBeInTheDocument()
    expect(screen.getByText(/zoning reform/)).not.toBeVisible()
    expect(screen.getByText(/second chart's source/)).not.toBeVisible()

    fireEvent.click(expand)
    expect(screen.getByText(/second chart's source/)).toBeVisible()
    expect(
      screen.getAllByRole("button", { name: "Collapse Ada Reader's comment" })[0],
    ).toHaveFocus()
  })

  it("shows the first replies at each level, and the rest on request", async () => {
    const [first, reply] = commentThread().comments
    const replies = Array.from({ length: 5 }, (_, i) => ({
      ...reply!,
      id: 10 + i,
      body: `Reply number ${i + 1}`,
    }))
    fetchMock.mockResolvedValue(Response.json(commentThread({ comments: [first!, ...replies] })))

    render(<Comments articleId={7} />)

    expect(await screen.findByText("Reply number 3")).toBeInTheDocument()
    expect(screen.queryByText("Reply number 4")).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "2 more replies" }))
    expect(screen.getByText("Reply number 5")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /more repl/ })).not.toBeInTheDocument()
  })

  it("copies a comment's link", async () => {
    const writeText = vi.fn<(text: string) => Promise<void>>().mockResolvedValue()
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } })
    fetchMock.mockResolvedValue(Response.json(commentThread()))
    window.history.replaceState(null, "", "/articles/x")

    render(<Comments articleId={7} />)
    const [share] = await screen.findAllByRole("button", { name: "Share" })
    fireEvent.click(share!)

    expect(await screen.findByRole("status")).toHaveTextContent("Link copied")
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/articles/x#comment-1`)
    expect(document.getElementById("comment-1")).toHaveTextContent(/zoning reform/)
  })

  it("keeps the reader's order, and puts what they just posted first", async () => {
    window.localStorage.setItem(SORT_KEY, "new")
    fetchMock.mockResolvedValueOnce(Response.json(signedIn)).mockResolvedValueOnce(posted("First!"))

    render(<Comments articleId={7} />)
    await screen.findByText(/zoning reform/)
    const topLevel = () =>
      within(screen.getAllByRole("list")[0]!)
        .getAllByRole("listitem")
        .filter((item) => item.parentElement === screen.getAllByRole("list")[0])
    // Newest first: the removed comment from 10 hours ago, then the one from 30.
    expect(topLevel()[0]).toHaveTextContent("This comment was removed.")

    fireEvent.change(screen.getByRole("textbox", { name: /Commenting as/ }), {
      target: { value: "First!" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Post comment" }))
    await screen.findByText("First!")
    expect(topLevel()[0]).toHaveTextContent("First!")
  })

  it("counts down the characters left near the limit", async () => {
    fetchMock.mockResolvedValue(Response.json({ ...signedIn, maxLength: 20 }))

    render(<Comments articleId={7} />)
    const box = await screen.findByRole("textbox", { name: /Commenting as/ })
    fireEvent.change(box, { target: { value: "Short" } })
    expect(screen.queryByText(/characters? left/)).not.toBeInTheDocument()
    fireEvent.change(box, { target: { value: "Nearly at the end!" } })
    expect(screen.getByText("2 characters left")).toBeInTheDocument()
    expect(box).toHaveAccessibleDescription("2 characters left")
  })

  it("leaves the countdown to the last 500 characters of a long limit", async () => {
    fetchMock.mockResolvedValue(Response.json({ ...signedIn, maxLength: 10_000 }))

    render(<Comments articleId={7} />)
    const box = await screen.findByRole("textbox", { name: /Commenting as/ })
    fireEvent.change(box, { target: { value: "x".repeat(9_000) } })
    expect(screen.queryByText(/characters? left/)).not.toBeInTheDocument()
    fireEvent.change(box, { target: { value: "x".repeat(9_600) } })
    expect(screen.getByText("400 characters left")).toBeInTheDocument()
  })

  it("tells analytics a comment was posted, with nothing about who wrote it", async () => {
    fetchMock
      .mockResolvedValueOnce(Response.json(signedIn))
      .mockResolvedValueOnce(Response.json({ message: "nope" }, { status: 500 }))
      .mockResolvedValueOnce(posted("Hi"))

    render(<Comments articleId={7} slug="zoning" />)
    const box = await screen.findByRole("textbox", { name: /Commenting as Ada Reader/ })
    fireEvent.change(box, { target: { value: "Hi" } })
    fireEvent.click(screen.getByRole("button", { name: "Post comment" }))
    await screen.findByRole("alert")
    expect(sendGAEvent).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole("button", { name: "Post comment" }))
    await screen.findByText("Hi")
    expect(sendGAEvent).toHaveBeenCalledOnce()
    expect(sendGAEvent).toHaveBeenCalledWith("event", "comment", {
      content_type: "article",
      item_id: "zoning",
      is_reply: false,
      held: false,
    })
  })

  it("tells analytics a reply was posted, and that a check held it", async () => {
    fetchMock.mockResolvedValueOnce(Response.json(signedIn)).mockResolvedValueOnce(
      Response.json(
        {
          comment: { ...(await posted("x").json()).comment, parentId: 1, depth: 1, held: true },
          held: "Links",
        },
        { status: 201 },
      ),
    )

    render(<Comments articleId={7} slug="zoning" />)
    fireEvent.click((await screen.findAllByRole("button", { name: "Reply" }))[0]!)
    fireEvent.change(screen.getByRole("textbox", { name: "Reply to Ada Reader" }), {
      target: { value: "x" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Post reply" }))

    await waitFor(() =>
      expect(sendGAEvent).toHaveBeenCalledWith("event", "comment", {
        content_type: "article",
        item_id: "zoning",
        is_reply: true,
        held: true,
      }),
    )
  })

  it("tells analytics a comment's link was copied", async () => {
    vi.stubGlobal("navigator", {
      ...navigator,
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    })
    fetchMock.mockResolvedValue(Response.json(commentThread()))

    render(<Comments articleId={7} slug="zoning" />)
    fireEvent.click((await screen.findAllByRole("button", { name: "Share" }))[0]!)

    await screen.findByRole("status")
    expect(sendGAEvent).toHaveBeenCalledWith("event", "share", {
      method: "copy_link",
      content_type: "comment",
      item_id: "zoning",
    })
  })

  it("tells analytics the reader is back signed in, once, and tidies the address", async () => {
    window.history.replaceState(null, "", "/articles/x?signed_in=google&ref=feed#comments")
    fetchMock.mockResolvedValue(Response.json(signedIn))

    render(<Comments articleId={7} slug="zoning" />)

    await screen.findByRole("textbox", { name: /Commenting as/ })
    expect(sendGAEvent).toHaveBeenCalledWith("event", "login", {
      method: "google",
      content_type: "comment",
      item_id: "zoning",
    })
    expect(`${window.location.pathname}${window.location.search}${window.location.hash}`).toBe(
      "/articles/x?ref=feed#comments",
    )
  })

  it("sends no sign-in event when the reader came back without a session", async () => {
    window.history.replaceState(null, "", "/articles/x?signed_in=google")
    fetchMock.mockResolvedValue(Response.json(commentThread()))

    render(<Comments articleId={7} />)

    await screen.findByText(/zoning reform/)
    expect(sendGAEvent).not.toHaveBeenCalled()
    expect(window.location.search).toBe("")
  })

  it("re-orders when the reader picks a sort, remembers it, and tells analytics", async () => {
    fetchMock.mockResolvedValue(Response.json(commentThread()))

    render(<Comments articleId={7} slug="zoning" />)
    fireEvent.change(await screen.findByRole("combobox", { name: "Sort comments" }), {
      target: { value: "new" },
    })

    expect(window.localStorage.getItem(SORT_KEY)).toBe("new")
    expect(sendGAEvent).toHaveBeenCalledWith("event", "comment_sort", {
      sort: "new",
      item_id: "zoning",
    })
    const list = screen.getAllByRole("list")[0]!
    expect(list.firstElementChild).toHaveTextContent("This comment was removed.")
  })
})
