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

import { CloneFromProduction } from ".."
import { CloneFromProductionMenuItem } from "../Client"

const housing = {
  title: "The Housing Theory of Everything",
  slug: "housing",
  publishedAt: "2026-05-04T12:00:00.000Z",
  existsLocally: false,
}
const transit = { title: "Transit Is Infrastructure", slug: "transit", existsLocally: true }

const json = (body: unknown, status = 200) => ({
  ok: status < 400,
  status,
  json: async () => body,
})

/** A promise the test settles by hand, to hold a clone request in flight. */
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => (resolve = r))
  return { promise, resolve }
}

type CloneResponse = ReturnType<typeof json>

/** Production search answers with `docs`; each clone request answers with the next of `clones`. */
function mockFetch({
  docs = [housing, transit] as unknown[],
  search = undefined as CloneResponse | undefined,
  clones = [] as (() => Promise<CloneResponse>)[],
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
    const first = deferred<CloneResponse>()
    const second = deferred<CloneResponse>()
    const fetchMock = mockFetch({ clones: [() => first.promise, () => second.promise] })
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
    // The second request waits for the first, keeping each inside the function time limit.
    expect(fetchMock).toHaveBeenCalledTimes(2)

    await act(async () => {
      first.resolve(json({ id: 11, slug: "housing", title: housing.title }))
    })

    expect(panel.getByRole("button", { name: "Cloning 2 of 2…" })).toBeInTheDocument()
    expect(within(housingRow!).getByLabelText("Cloned")).toBeInTheDocument()
    expect(within(transitRow!).getByRole("progressbar")).toBeInTheDocument()
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/articles/clone-from-production",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ slug: "transit" }) }),
    )

    await act(async () => {
      second.resolve(json({ id: 12, slug: "transit-1", title: transit.title }))
    })

    expect(panel.getByRole("button", { name: "Clone" })).toBeDisabled()
    expect(panel.queryByRole("progressbar")).not.toBeInTheDocument()
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it("links each cloned article in a new tab and names a slug that had to change", async () => {
    mockFetch({
      clones: [
        async () => json({ id: 11, slug: "housing", title: housing.title }),
        async () => json({ id: 12, slug: "transit-1", title: transit.title }),
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
        async () => json({ error: "Clone failed: boom" }, 500),
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
    expect(housingRow).toHaveTextContent("Clone failed: boom")
    expect(transitRow).toHaveTextContent("Network down")
    expect(panel.queryByRole("link")).not.toBeInTheDocument()
  })

  it("counts the seconds a clone has been running", async () => {
    const pending = deferred<CloneResponse>()
    mockFetch({ clones: [() => pending.promise] })
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
