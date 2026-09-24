import { afterEach, describe, expect, it, vi } from "vitest"

import type * as GetURL from "@/utilities/getURL"

// canUseDOM is fixed at import, so each case mocks it and re-imports getURL.
const load = async (canUseDOM: boolean): Promise<typeof GetURL> => {
  vi.resetModules()
  vi.doMock("@/utilities/canUseDOM", () => ({ default: canUseDOM }))
  return import("@/utilities/getURL")
}

const stubLocation = (location: Pick<Location, "protocol" | "hostname" | "port">): void => {
  vi.stubGlobal("window", { location })
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.doUnmock("@/utilities/canUseDOM")
})

describe("getServerSideURL", () => {
  it("uses NEXT_PUBLIC_SERVER_URL", async () => {
    vi.stubEnv("NEXT_PUBLIC_SERVER_URL", "https://pragmaticpapers.com")
    const { getServerSideURL } = await load(false)

    expect(getServerSideURL()).toBe("https://pragmaticpapers.com")
  })

  it.each([undefined, ""])("falls back to the dev server when it is %j", async (value) => {
    vi.stubEnv("NEXT_PUBLIC_SERVER_URL", value)
    const { getServerSideURL } = await load(false)

    expect(getServerSideURL()).toBe("http://localhost:8000")
  })
})

describe("getClientSideURL", () => {
  it("reads the origin from the browser, ignoring the env", async () => {
    vi.stubEnv("NEXT_PUBLIC_SERVER_URL", "https://pragmaticpapers.com")
    stubLocation({ protocol: "https:", hostname: "preview.example.com", port: "" })
    const { getClientSideURL } = await load(true)

    expect(getClientSideURL()).toBe("https://preview.example.com")
  })

  it("keeps a non-default port", async () => {
    stubLocation({ protocol: "http:", hostname: "localhost", port: "8000" })
    const { getClientSideURL } = await load(true)

    expect(getClientSideURL()).toBe("http://localhost:8000")
  })

  it("uses NEXT_PUBLIC_SERVER_URL on the server", async () => {
    vi.stubEnv("NEXT_PUBLIC_SERVER_URL", "https://pragmaticpapers.com")
    const { getClientSideURL } = await load(false)

    expect(getClientSideURL()).toBe("https://pragmaticpapers.com")
  })

  it("returns an empty string on the server without NEXT_PUBLIC_SERVER_URL", async () => {
    vi.stubEnv("NEXT_PUBLIC_SERVER_URL", undefined)
    const { getClientSideURL } = await load(false)

    expect(getClientSideURL()).toBe("")
  })
})
