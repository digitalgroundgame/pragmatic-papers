import { render, screen, within } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { IntegrationStatusField } from "../components/IntegrationStatusField"

afterEach(() => {
  vi.unstubAllEnvs()
})

const row = (label: string) =>
  screen.getByRole("cell", { name: new RegExp(`^${label}`) }).closest("tr")!

describe("IntegrationStatusField", () => {
  it("lists every connection with what this environment is missing, by name only", () => {
    vi.stubEnv("YOUTUBE_API_KEY", "")
    vi.stubEnv("YOUTUBE_CHANNEL_IDS", "")
    vi.stubEnv("X_BEARER_TOKEN", "secret-token")
    vi.stubEnv("X_USERNAMES", "")
    render(<IntegrationStatusField />)

    expect(
      screen.getByRole("table", { name: "Connections in this environment" }),
    ).toBeInTheDocument()

    const youtube = within(row("YouTube channels"))
    expect(youtube.getByText("Not connected")).toBeInTheDocument()
    expect(youtube.getByText(/^Required:/)).toHaveTextContent("Required: YOUTUBE_API_KEY")
    expect(youtube.getByText(/^Optional:/)).toHaveTextContent("Optional: YOUTUBE_CHANNEL_IDS")

    const x = within(row("X posts"))
    expect(x.getByText("Connected")).toBeInTheDocument()
    expect(x.queryByText(/^Required:/)).not.toBeInTheDocument()

    expect(document.body).not.toHaveTextContent("secret-token")
  })

  it("says nothing is left to set once every variable is", () => {
    vi.stubEnv("BLUESKY_HANDLES", "someone.bsky.social")
    render(<IntegrationStatusField />)
    const bluesky = within(row("Bluesky posts"))
    expect(bluesky.getByText("Connected")).toBeInTheDocument()
    expect(bluesky.getByText("Nothing")).toBeInTheDocument()
  })
})
