import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

// Hoisted, because `vi.mock` factories are lifted above ordinary declarations.
const { toast, refresh } = vi.hoisted(() => ({
  toast: { success: vi.fn(), warning: vi.fn(), error: vi.fn() },
  refresh: vi.fn(),
}))

// `@payloadcms/ui` pulls the whole admin runtime; the button and toaster are
// all this component touches.
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

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

describe("SyncNowButton", () => {
  it("runs the sync and pulls the refreshed rows in", async () => {
    mockFetch({ body: { jobId: 7, configured: true } })

    render(<SyncNowButton />)
    await act(async () => {
      fireEvent.click(screen.getByRole("button"))
    })

    expect(fetch).toHaveBeenCalledWith("/api/merch/sync", {
      method: "POST",
      credentials: "include",
    })
    expect(toast.success).toHaveBeenCalled()
    expect(refresh).toHaveBeenCalled()
  })

  it("warns rather than claiming success when Shopify isn't configured", async () => {
    // The job logs and skips in that case, so a success toast would be a lie.
    mockFetch({ body: { jobId: 7, configured: false } })

    render(<SyncNowButton />)
    await act(async () => {
      fireEvent.click(screen.getByRole("button"))
    })

    expect(toast.warning).toHaveBeenCalled()
    expect(toast.success).not.toHaveBeenCalled()
    expect(refresh).not.toHaveBeenCalled()
  })

  it("surfaces a failed request", async () => {
    mockFetch({ ok: false, status: 401 })

    render(<SyncNowButton />)
    await act(async () => {
      fireEvent.click(screen.getByRole("button"))
    })

    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("401"))
    expect(refresh).not.toHaveBeenCalled()
  })

  it("re-enables itself after a run so a second sync is possible", async () => {
    mockFetch({ body: { configured: true } })

    render(<SyncNowButton />)
    const button = screen.getByRole("button")
    await act(async () => {
      fireEvent.click(button)
    })

    expect(button).not.toBeDisabled()
    // `textContent`, not an exact match on the node: the button also renders an
    // icon, which contributes no text.
    expect(button.textContent).toContain("Sync Shopify")
  })
})
