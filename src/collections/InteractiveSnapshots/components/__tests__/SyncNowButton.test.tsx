import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

// Hoisted, because `vi.mock` factories are lifted above ordinary declarations.
const { toast, refresh } = vi.hoisted(() => ({
  toast: { success: vi.fn(), info: vi.fn(), warning: vi.fn(), error: vi.fn() },
  refresh: vi.fn(),
}))

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
  toast,
}))

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }))

import { SyncNowButton } from "../SyncNowButton"

function mockFetch(response: { ok?: boolean; status?: number; body?: unknown }): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: response.ok ?? true,
      status: response.status ?? 200,
      json: async () => response.body ?? {},
    })),
  )
}

async function clickSync(): Promise<void> {
  render(<SyncNowButton />)
  await act(async () => {
    fireEvent.click(screen.getByRole("button"))
  })
}

const counts = (c: Partial<Record<"synced" | "unchanged" | "skipped" | "failed", number>>) => ({
  synced: 0,
  unchanged: 0,
  skipped: 0,
  failed: 0,
  ...c,
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

describe("SyncNowButton (interactive snapshots)", () => {
  it("runs the sync and pulls the new drafts into the list", async () => {
    mockFetch({ body: { jobId: 3, result: counts({ synced: 1 }) } })
    await clickSync()

    expect(fetch).toHaveBeenCalledWith("/api/interactive-snapshots/sync", {
      method: "POST",
      credentials: "include",
    })
    expect(toast.success).toHaveBeenCalledWith("Synced 1 feed — new draft snapshot to review.")
    expect(refresh).toHaveBeenCalled()
  })

  it.each([
    [
      counts({ synced: 2, unchanged: 1 }),
      "success",
      "Synced 2 feeds — new draft snapshots to review.",
    ],
    [
      counts({ synced: 1, failed: 1 }),
      "error",
      "Sync finished with 1 failed feed — see the server log.",
    ],
    [counts({ failed: 3 }), "error", "Sync finished with 3 failed feeds — see the server log."],
    [
      counts({ skipped: 2 }),
      "warning",
      "Nothing synced: every feed was skipped (token not set, or feed disabled).",
    ],
    [counts({ skipped: 1, unchanged: 1 }), "info", "Every feed is already up to date."],
    [counts({ unchanged: 2 }), "info", "Every feed is already up to date."],
  ] as const)("reports %o as a %s toast", async (result, level, message) => {
    mockFetch({ body: { result } })
    await clickSync()
    expect(toast[level]).toHaveBeenCalledWith(message)
  })

  it("finds the counts however deeply the job runner nests them", async () => {
    mockFetch({ body: { result: { jobStatus: { "42": { output: counts({ synced: 1 }) } } } } })
    await clickSync()
    expect(toast.success).toHaveBeenCalledWith("Synced 1 feed — new draft snapshot to review.")
  })

  it("falls back to a plain confirmation when the output carries no counts", async () => {
    // Cyclic on purpose: the walk must not loop on a result it has already seen.
    const cyclic: Record<string, unknown> = { synced: "1" }
    cyclic.self = cyclic
    mockFetch({ body: { result: cyclic } })
    await clickSync()
    expect(toast.success).toHaveBeenCalledWith("Sync ran.")
    expect(refresh).toHaveBeenCalled()
  })

  it("surfaces a failed request without refreshing", async () => {
    mockFetch({ ok: false, status: 500 })
    await clickSync()
    expect(toast.error).toHaveBeenCalledWith("Sync failed: HTTP 500")
    expect(refresh).not.toHaveBeenCalled()
  })

  it("still reports a failure that isn't an Error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject("offline")),
    )
    await clickSync()
    expect(toast.error).toHaveBeenCalledWith("Sync failed: unknown error")
  })

  it("disables itself while the sync runs and re-enables once it settles", async () => {
    let settle!: (res: unknown) => void
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise((resolve) => (settle = resolve))),
    )
    render(<SyncNowButton />)
    const button = screen.getByRole("button")

    await act(async () => {
      fireEvent.click(button)
    })
    expect(button).toBeDisabled()
    expect(button).toHaveTextContent("Syncing...")

    await act(async () => {
      settle({ ok: true, status: 200, json: async () => ({}) })
    })
    expect(button).not.toBeDisabled()
    expect(button).toHaveTextContent("Sync data feeds")
  })
})
