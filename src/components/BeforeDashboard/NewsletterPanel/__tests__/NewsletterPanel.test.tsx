import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { NewsletterPanel } from ".."
import { loadNewsletterOverview } from "../load"

vi.mock("../load", () => ({ loadNewsletterOverview: vi.fn() }))

describe("NewsletterPanel", () => {
  it("renders what Listmonk reports on each visit", async () => {
    vi.mocked(loadNewsletterOverview).mockResolvedValue({
      connected: false,
      missing: ["LISTMONK_BASE_URL"],
    })
    render(await NewsletterPanel())
    expect(loadNewsletterOverview).toHaveBeenCalledOnce()
    expect(screen.getByText(/isn't connected/)).toHaveTextContent("LISTMONK_BASE_URL")
  })
})
