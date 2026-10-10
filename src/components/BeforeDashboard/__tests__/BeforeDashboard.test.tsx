import { render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import type { User } from "@/payload-types"

import BeforeDashboard from ".."

vi.mock("../NewsletterPanel", () => ({
  NewsletterPanel: () => <p>Newsletter panel</p>,
}))
vi.mock("../SeedButton", () => ({ SeedButton: () => <button type="button">Seed</button> }))
vi.mock("@payloadcms/ui/elements/Banner", () => ({
  Banner: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

const user = (roles: string[]) => ({ id: 1, roles }) as unknown as User

afterEach(() => vi.unstubAllEnvs())

describe("BeforeDashboard", () => {
  it("shows admins the newsletter panel", () => {
    render(<BeforeDashboard user={user(["admin"])} />)
    expect(screen.getByText("Newsletter panel")).toBeInTheDocument()
  })

  it("keeps subscribers' emails from everyone else", () => {
    render(<BeforeDashboard user={user(["editor"])} />)
    expect(screen.queryByText("Newsletter panel")).not.toBeInTheDocument()
    render(<BeforeDashboard user={null} />)
    expect(screen.queryByText("Newsletter panel")).not.toBeInTheDocument()
  })

  it("shows the dev instructions outside production", () => {
    render(<BeforeDashboard user={user(["editor"])} />)
    expect(screen.getByText("Welcome to your dashboard!")).toBeInTheDocument()
  })

  it("shows only the panel in production", () => {
    vi.stubEnv("NODE_ENV", "production")
    render(<BeforeDashboard user={user(["chief-editor"])} />)
    expect(screen.getByText("Newsletter panel")).toBeInTheDocument()
    expect(screen.queryByText("Welcome to your dashboard!")).not.toBeInTheDocument()
  })

  it("renders nothing in production for non-admins", () => {
    vi.stubEnv("NODE_ENV", "production")
    const { container } = render(<BeforeDashboard user={user(["writer"])} />)
    expect(container).toBeEmptyDOMElement()
  })
})
