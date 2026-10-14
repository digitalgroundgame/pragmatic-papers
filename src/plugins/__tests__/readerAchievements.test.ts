import type { Payload, PayloadRequest } from "payload"
import { describe, expect, it, vi } from "vitest"

import { achievementsOptions } from "../readerAchievements"

vi.mock("../sso", () => ({ getSignedInUser: vi.fn(async () => ({ id: 4 })) }))

const payloadWith = (switches: Record<string, boolean>) =>
  ({ findGlobal: vi.fn(async () => ({ switches })) }) as unknown as Payload

describe("achievementsOptions", () => {
  it("follows the achievements switch on System → Plugins", async () => {
    const { enabled } = achievementsOptions
    if (typeof enabled !== "function") throw new Error("enabled should read the switch")
    expect(await enabled(payloadWith({ achievements: true }))).toBe(true)
    expect(await enabled(payloadWith({ achievements: false }))).toBe(false)
  })

  it("asks the sign-in plugin who's signed in, members included", async () => {
    expect(await achievementsOptions.currentUser({} as PayloadRequest)).toEqual({ id: 4 })
  })

  it("counts readers towards first members, never staff", () => {
    const { isMember } = achievementsOptions
    expect(isMember({ id: 1, roles: ["member"] })).toBe(true)
    expect(isMember({ id: 2, roles: ["member", "editor"] })).toBe(false)
    expect(isMember({ id: 3, roles: ["writer"] })).toBe(false)
  })

  it("takes a provider-verified address as verified", () => {
    const { isVerified } = achievementsOptions
    expect(isVerified?.({ id: 1, emailVerified: true })).toBe(true)
    expect(isVerified?.({ id: 1, emailVerified: false })).toBe(false)
  })
})
