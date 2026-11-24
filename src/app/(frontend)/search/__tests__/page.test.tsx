import { cleanup, render, screen } from "@testing-library/react"
import type React from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

const { find } = vi.hoisted(() => ({ find: vi.fn() }))

vi.mock("next/headers", () => ({ draftMode: async () => ({ isEnabled: false }) }))
vi.mock("@payload-config", () => ({ default: {} }))
vi.mock("@/data/payload", () => ({ getPayloadClient: async () => ({ find }) }))
vi.mock("@payloadcms/db-postgres", () => ({ sql: () => "" }))

import SearchPage from "../page"

afterEach(cleanup)

describe("SearchPage", () => {
  it("draws its form with the site's Input and Button", async () => {
    find.mockResolvedValue({ docs: [], totalDocs: 0, totalPages: 1, page: 1 })
    render((await SearchPage({ searchParams: Promise.resolve({}) })) as React.ReactElement)

    const field = screen.getByRole("searchbox", { name: "Search the site" })
    expect(field).toHaveAttribute("data-slot", "input")
    expect(field).toHaveAttribute("name", "q")
    const submit = screen.getByRole("button", { name: "Search" })
    expect(submit).toHaveAttribute("data-slot", "button")
    expect(submit).toHaveAttribute("type", "submit")
  })
})
