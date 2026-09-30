import type { PayloadRequest } from "payload"
import { afterEach, describe, expect, it, vi } from "vitest"

import { canRunJobs } from "../access"

function request({
  user = null,
  authorization,
}: {
  user?: PayloadRequest["user"]
  authorization?: string
}): { req: PayloadRequest } {
  const headers = new Headers(authorization ? { authorization } : {})
  return { req: { user, headers } as PayloadRequest }
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("canRunJobs", () => {
  it("lets any logged-in user run jobs, with or without a secret", () => {
    vi.stubEnv("CRON_SECRET", "")

    expect(canRunJobs(request({ user: { id: 1 } as PayloadRequest["user"] }))).toBe(true)
  })

  it("lets a caller with the secret run jobs", () => {
    vi.stubEnv("CRON_SECRET", "s3cret")

    expect(canRunJobs(request({ authorization: "Bearer s3cret" }))).toBe(true)
  })

  it.each([
    ["no header", undefined],
    ["a wrong secret", "Bearer wrong"],
    ["the secret without the Bearer scheme", "s3cret"],
  ])("refuses a caller with %s", (_, authorization) => {
    vi.stubEnv("CRON_SECRET", "s3cret")

    expect(canRunJobs(request({ authorization }))).toBe(false)
  })

  it.each([
    ["unset", undefined],
    ["empty", ""],
  ])("closes the Bearer route when CRON_SECRET is %s", (_, value) => {
    if (value === undefined) vi.stubEnv("CRON_SECRET", undefined as unknown as string)
    else vi.stubEnv("CRON_SECRET", value)

    expect(canRunJobs(request({ authorization: "Bearer undefined" }))).toBe(false)
    expect(canRunJobs(request({ authorization: "Bearer " }))).toBe(false)
  })
})
