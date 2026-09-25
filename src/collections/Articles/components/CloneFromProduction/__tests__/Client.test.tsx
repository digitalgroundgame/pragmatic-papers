import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

const { openModal, refresh } = vi.hoisted(() => ({ openModal: vi.fn(), refresh: vi.fn() }))

interface Option {
  label: string
  value: string
}

// `@payloadcms/ui` pulls the whole admin runtime. The select stands in as a text box plus one
// button per option, which is all the panel relies on: typing searches, clicking selects.
vi.mock("@payloadcms/ui", () => ({
  Button: ({
    children,
    disabled,
    onClick,
  }: {
    children: React.ReactNode
    disabled?: boolean
    onClick?: () => void
  }) => (
    <button disabled={disabled} onClick={onClick} type="button">
      {children}
    </button>
  ),
  CheckIcon: () => <svg aria-label="Cloned" />,
  Drawer: ({ children, title }: { children: React.ReactNode; title: string }) => (
    <section aria-label={title}>{children}</section>
  ),
  PopupList: {
    Button: ({
      children,
      disabled,
      onClick,
    }: {
      children: React.ReactNode
      disabled?: boolean
      onClick?: () => void
    }) => (
      <button disabled={disabled} onClick={onClick} type="button">
        {children}
      </button>
    ),
  },
  ReactSelect: ({
    disabled,
    isLoading,
    noOptionsMessage,
    onChange,
    onInputChange,
    options,
    value,
  }: {
    disabled?: boolean
    isLoading?: boolean
    noOptionsMessage: () => string
    onChange: (value: Option[]) => void
    onInputChange: (value: string) => void
    options: Option[]
    value: Option[]
  }) => (
    <div>
      <input
        aria-label="Search production"
        disabled={disabled}
        onChange={(e) => onInputChange(e.target.value)}
      />
      {isLoading && <span>Loading options</span>}
      {!isLoading && !options.length && <span>{noOptionsMessage()}</span>}
      {options.map((o) => (
        <button key={o.value} onClick={() => onChange([...value, o])} type="button">
          {o.label}
        </button>
      ))}
    </div>
  ),
  Spinner: () => <span aria-label="Cloning" role="progressbar" />,
  useConfig: () => ({ config: { routes: { admin: "/admin", api: "/api" } } }),
  useDebounce: <T,>(value: T) => value,
  useModal: () => ({ openModal }),
  XIcon: () => <svg aria-label="Failed" />,
}))

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }))

import type { CloneEvent } from "@/collections/Articles/endpoints/cloneFromProduction"

import { CloneFromProduction } from ".."
import { CloneFromProductionMenuItem } from "../Client"

const housing = {
  title: "The Housing Theory of Everything",
  slug: "housing",
  publishedAt: "2026-05-04T12:00:00.000Z",
  existsLocally: false,
}
const transit = { title: "Transit Is Infrastructure", slug: "transit", existsLocally: true }

interface FakeResponse {
  ok: boolean
  status: number
  json: () => Promise<unknown>
  body?: ReadableStream<Uint8Array>
}

const json = (body: unknown, status = 200): FakeResponse => ({
  ok: status < 400,
  status,
  json: async () => body,
})

/** A clone response left open, whose NDJSON lines the test sends by hand. */
function cloneStream() {
  let controller!: ReadableStreamDefaultController<Uint8Array>
  const body = new ReadableStream<Uint8Array>({ start: (c) => void (controller = c) })
  const encoder = new TextEncoder()
  return {
    response: { ok: true, status: 200, json: async () => ({}), body } as FakeResponse,
    send: (event: CloneEvent) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`)),
    close: () => controller.close(),
  }
}

/** A clone response that streams `events` and ends. */
function streamed(...events: CloneEvent[]): FakeResponse {
  const stream = cloneStream()
  events.forEach(stream.send)
  stream.close()
  return stream.response
}

const done = (id: number, slug: string, title: string): CloneEvent => ({
  type: "done",
  id,
  slug,
  title,
  created: { articles: 1 },
})

/** Lets the drawer read what the stream has sent so far. */
const flush = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)))

/** Production search answers with `docs`; each clone request answers with the next of `clones`. */
function mockFetch({
  docs = [housing, transit] as unknown[],
  search = undefined as FakeResponse | undefined,
  clones = [] as (() => Promise<FakeResponse>)[],
} = {}) {
  const queue = [...clones]
  const fetchMock = vi.fn(async (url: string) =>
    url.startsWith("/api/articles/production-search")
      ? (search ?? json({ docs }))
      : queue.shift()!(),
  )
  vi.stubGlobal("fetch", fetchMock)
  return fetchMock
}

async function openPanel() {
  render(<CloneFromProductionMenuItem allowed />)
  return within(screen.getByRole("region", { name: "Clone from production" }))
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe("CloneFromProduction", () => {
  it("tells staff who can't clone why, rather than showing an empty menu", () => {
    render(<CloneFromProductionMenuItem allowed={false} />)

    expect(screen.getByRole("button", { name: /admins only/ })).toBeDisabled()
    expect(screen.queryByRole("region")).not.toBeInTheDocument()
  })

  it("lets admins through and holds everyone else to the disabled item", () => {
    render(<>{CloneFromProduction({ user: { roles: ["admin"] } } as never)}</>)
    expect(screen.getByRole("button", { name: "Clone from production…" })).toBeEnabled()
    cleanup()

    render(<>{CloneFromProduction({ user: { roles: ["writer"] } } as never)}</>)
    expect(screen.getByRole("button", { name: /admins only/ })).toBeDisabled()
  })

  it("opens the drawer from the menu item", async () => {
    mockFetch()
    render(<CloneFromProductionMenuItem allowed />)

    fireEvent.click(screen.getByRole("button", { name: "Clone from production…" }))

    expect(openModal).toHaveBeenCalledWith("clone-from-production")
    await screen.findByRole("button", { name: /Housing/ })
  })

  it("searches production as you type and labels articles already here", async () => {
    const fetchMock = mockFetch()
    const panel = await openPanel()

    const date = new Date(housing.publishedAt).toLocaleDateString()
    expect(
      await panel.findByRole("button", { name: `${housing.title} (${date})` }),
    ).toBeInTheDocument()
    expect(
      panel.getByRole("button", { name: `${transit.title} · already here, will clone as a copy` }),
    ).toBeInTheDocument()

    fireEvent.change(panel.getByLabelText("Search production"), { target: { value: "rent & tax" } })

    expect(panel.getByText("Loading options")).toBeInTheDocument()
    await panel.findByRole("button", { name: /Housing/ })
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/articles/production-search?q=rent%20%26%20tax",
      expect.objectContaining({ credentials: "include" }),
    )
  })

  it("shows why the search came back empty when production can't be reached", async () => {
    mockFetch({ search: json({ error: "Could not reach production" }, 502) })
    const panel = await openPanel()

    expect(await panel.findByText("Could not reach production")).toBeInTheDocument()
  })

  it("clones one article at a time, showing which is in flight and which are waiting", async () => {
    const first = cloneStream()
    const second = cloneStream()
    const fetchMock = mockFetch({
      clones: [async () => first.response, async () => second.response],
    })
    const panel = await openPanel()

    fireEvent.click(await panel.findByRole("button", { name: /Housing/ }))
    fireEvent.click(panel.getByRole("button", { name: /Transit/ }))
    await act(async () => {
      fireEvent.click(panel.getByRole("button", { name: "Clone 2 articles" }))
    })

    expect(panel.getByRole("button", { name: "Cloning 1 of 2…" })).toBeDisabled()
    expect(panel.getByLabelText("Search production")).toBeDisabled()
    const [housingRow, transitRow] = panel.getAllByRole("listitem")
    expect(within(housingRow!).getByRole("progressbar")).toBeInTheDocument()
    expect(housingRow).toHaveTextContent(housing.title)
    expect(transitRow).toHaveClass("clone-from-production__outcome--queued")
    expect(transitRow).toHaveTextContent(transit.title)
    // The second request waits for the first to finish.
    expect(fetchMock).toHaveBeenCalledTimes(2)

    first.send({ type: "progress", created: { topics: 1, media: 1 } })
    first.send({ type: "ping" })
    first.send({ type: "progress", created: { topics: 1, media: 3, users: 1, articles: 1 } })
    await flush()

    // Running totals, leaving out articles: the one being cloned counts itself at the end.
    expect(housingRow).toHaveTextContent("3 images · 1 user · 1 topic")
    expect(housingRow).not.toHaveTextContent(/article/)

    first.send(done(11, "housing", housing.title))
    first.close()
    await flush()

    expect(panel.getByRole("button", { name: "Cloning 2 of 2…" })).toBeInTheDocument()
    expect(within(housingRow!).getByLabelText("Cloned")).toBeInTheDocument()
    expect(within(transitRow!).getByRole("progressbar")).toBeInTheDocument()
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/articles/clone-from-production",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ slug: "transit" }) }),
    )

    second.send(done(12, "transit-1", transit.title))
    second.close()
    await flush()

    expect(panel.getByRole("button", { name: "Clone" })).toBeDisabled()
    expect(panel.queryByRole("progressbar")).not.toBeInTheDocument()
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it("links each cloned article in a new tab and names a slug that had to change", async () => {
    mockFetch({
      clones: [
        async () => streamed(done(11, "housing", housing.title)),
        async () => streamed(done(12, "transit-1", transit.title)),
      ],
    })
    const panel = await openPanel()

    fireEvent.click(await panel.findByRole("button", { name: /Housing/ }))
    fireEvent.click(panel.getByRole("button", { name: /Transit/ }))
    await act(async () => {
      fireEvent.click(panel.getByRole("button", { name: "Clone 2 articles" }))
    })

    const housingLink = panel.getByRole("link", { name: housing.title })
    expect(housingLink).toHaveAttribute("href", "/admin/collections/articles/11")
    expect(housingLink).toHaveAttribute("target", "_blank")
    expect(housingLink).toHaveAttribute("rel", expect.stringContaining("noopener"))
    const [housingRow, transitRow] = panel.getAllByRole("listitem")
    expect(housingRow).not.toHaveTextContent(/ as /)
    expect(transitRow).toHaveTextContent("as transit-1")
  })

  it("reports a failed clone with the reason and carries on with the rest", async () => {
    mockFetch({
      clones: [
        async () => json({ error: "Unauthorized" }, 401),
        async () => {
          throw new Error("Network down")
        },
      ],
    })
    const panel = await openPanel()

    fireEvent.click(await panel.findByRole("button", { name: /Housing/ }))
    fireEvent.click(panel.getByRole("button", { name: /Transit/ }))
    await act(async () => {
      fireEvent.click(panel.getByRole("button", { name: "Clone 2 articles" }))
    })

    const [housingRow, transitRow] = panel.getAllByRole("listitem")
    expect(within(housingRow!).getByLabelText("Failed")).toBeInTheDocument()
    expect(housingRow).toHaveTextContent("Unauthorized")
    expect(transitRow).toHaveTextContent("Network down")
    expect(panel.queryByRole("link")).not.toBeInTheDocument()
  })

  it("reports a failure the server streams, and a stream that ends without a result", async () => {
    mockFetch({
      clones: [
        async () =>
          streamed(
            { type: "progress", created: { media: 2 } },
            { type: "error", message: "Clone failed: boom" },
          ),
        async () => streamed({ type: "progress", created: { media: 1 } }),
      ],
    })
    const panel = await openPanel()

    fireEvent.click(await panel.findByRole("button", { name: /Housing/ }))
    fireEvent.click(panel.getByRole("button", { name: /Transit/ }))
    await act(async () => {
      fireEvent.click(panel.getByRole("button", { name: "Clone 2 articles" }))
    })
    await flush()

    const [housingRow, transitRow] = panel.getAllByRole("listitem")
    expect(housingRow).toHaveTextContent("Clone failed: boom")
    expect(within(transitRow!).getByLabelText("Failed")).toBeInTheDocument()
    expect(transitRow).toHaveTextContent("The connection closed before the clone finished")
  })

  it("counts the seconds a clone has been running", async () => {
    const pending = cloneStream()
    mockFetch({ clones: [async () => pending.response] })
    const panel = await openPanel()
    fireEvent.click(await panel.findByRole("button", { name: /Housing/ }))

    vi.useFakeTimers()
    await act(async () => {
      fireEvent.click(panel.getByRole("button", { name: "Clone" }))
    })
    const row = panel.getByRole("listitem")
    expect(row).toHaveTextContent("0s")

    await act(async () => {
      vi.advanceTimersByTime(3000)
    })
    expect(row).toHaveTextContent("3s")
    expect(panel.getByRole("button", { name: "Cloning…" })).toBeInTheDocument()
  })
})
