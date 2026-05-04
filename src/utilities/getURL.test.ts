import { describe, it, expect, vi } from "vitest"
import { getServerSideURL, getClientSideURL } from "./getURL"

vi.mock("./canUseDOM", () => ({
  default: false,
}))

describe("getServerSideURL", () => {
  it("returns env variable when set", () => {
    const original = process.env.NEXT_PUBLIC_SERVER_URL
    process.env.NEXT_PUBLIC_SERVER_URL = "https://example.com"
    expect(getServerSideURL()).toBe("https://example.com")
    process.env.NEXT_PUBLIC_SERVER_URL = original
  })

  it("returns default when env variable not set", () => {
    const original = process.env.NEXT_PUBLIC_SERVER_URL
    // @ts-expect-error - deleting for test purposes
    delete process.env.NEXT_PUBLIC_SERVER_URL
    expect(getServerSideURL()).toBe("http://localhost:8000")
    process.env.NEXT_PUBLIC_SERVER_URL = original
  })
})

describe("getClientSideURL", () => {
  it("returns server URL when not in browser (canUseDOM is false)", () => {
    const original = process.env.NEXT_PUBLIC_SERVER_URL
    process.env.NEXT_PUBLIC_SERVER_URL = "https://example.com"
    expect(getClientSideURL()).toBe("https://example.com")
    process.env.NEXT_PUBLIC_SERVER_URL = original
  })

  it("returns empty string when not in browser and no env set", () => {
    const original = process.env.NEXT_PUBLIC_SERVER_URL
    // @ts-expect-error - deleting for test purposes
    delete process.env.NEXT_PUBLIC_SERVER_URL
    expect(getClientSideURL()).toBe("")
    process.env.NEXT_PUBLIC_SERVER_URL = original
  })
})
