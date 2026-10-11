import { render, screen } from "@testing-library/react"
import { notFound } from "next/navigation"
import { describe, expect, it, vi } from "vitest"

import type { User } from "@/payload-types"

import { loadNewsletterOverview } from "../load"
import { NewsletterView } from "../NewsletterView"

vi.mock("../load", () => ({ loadNewsletterOverview: vi.fn() }))
vi.mock("@payloadcms/ui", () => ({
  Gutter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SetStepNav: () => null,
}))
vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND")
  }),
}))

const user = (roles: string[]) => ({ id: 1, roles }) as unknown as User

describe("NewsletterView", () => {
  it("renders what Listmonk reports on each visit", async () => {
    vi.mocked(loadNewsletterOverview).mockResolvedValue({ connected: false })
    render(await NewsletterView({ user: user(["admin"]) }))
    expect(loadNewsletterOverview).toHaveBeenCalledOnce()
    expect(screen.getByText(/isn't connected/)).toBeInTheDocument()
  })

  it("keeps subscribers' emails from everyone but admins", async () => {
    await expect(NewsletterView({ user: user(["editor"]) })).rejects.toThrow("NEXT_NOT_FOUND")
    await expect(NewsletterView({ user: null })).rejects.toThrow("NEXT_NOT_FOUND")
    expect(notFound).toHaveBeenCalledTimes(2)
  })
})
