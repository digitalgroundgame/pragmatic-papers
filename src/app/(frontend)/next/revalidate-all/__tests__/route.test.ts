import { beforeEach, describe, expect, it, vi } from "vitest"

const revalidatePath = vi.fn()

vi.mock("next/cache", () => ({ revalidatePath }))

const { POST } = await import("../route")

const request = (authorization?: string): Request =>
  new Request("http://localhost/next/revalidate-all", {
    method: "POST",
    headers: authorization ? { authorization } : {},
  })

describe("POST /next/revalidate-all", () => {
  beforeEach(() => {
    vi.stubEnv("PAYLOAD_SECRET", "s3cret")
    revalidatePath.mockClear()
  })

  it("throws away every prerendered route", async () => {
    const response = await POST(request("Bearer s3cret"))

    expect(response.status).toBe(200)
    expect(revalidatePath).toHaveBeenCalledExactlyOnceWith("/", "layout")
  })

  it.each([
    ["no header", undefined],
    ["the wrong secret", "Bearer nope"],
    ["the secret without the Bearer scheme", "s3cret"],
    ["a prefix of the secret", "Bearer s3cre"],
  ])("refuses a request with %s", async (_, authorization) => {
    const response = await POST(request(authorization))

    expect(response.status).toBe(401)
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it("refuses everything when PAYLOAD_SECRET is unset", async () => {
    vi.stubEnv("PAYLOAD_SECRET", "")

    expect((await POST(request("Bearer "))).status).toBe(401)
    expect(revalidatePath).not.toHaveBeenCalled()
  })
})
