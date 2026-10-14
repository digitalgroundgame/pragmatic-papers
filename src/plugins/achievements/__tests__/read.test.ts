import type { PayloadRequest } from "payload"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { achievementsReader, type AchievementsPluginConfig } from ".."
import { EARLY_MEMBER } from "../constants"
import { mineEndpoint } from "../endpoints/mine"
import { resolveAchievementsConfig } from ".."

import { fakePayload } from "./fakePayload"

const enabled = vi.fn()
const currentUser = vi.fn()
const options: AchievementsPluginConfig = {
  enabled,
  currentUser,
  isMember: () => true,
  moderators: () => true,
  admins: () => true,
}

const ada = { id: 1, emailVerified: true }
const ben = { id: 2, emailVerified: true }
const cy = { id: 3, emailVerified: false }

const rows = () => [
  { id: 1, user: 1, achievement: EARLY_MEMBER, earnedAt: "2026-10-18T12:00:00.000Z" },
  { id: 2, user: 2, achievement: "verified", revoked: true },
]

beforeEach(() => {
  vi.clearAllMocks()
  enabled.mockResolvedValue(true)
})

describe("achievementsReader().badgesFor", () => {
  it("gives each user their highest badge, in one query, leaving out those with none", async () => {
    const { payload } = fakePayload({ rows: rows() })
    const req = { payload } as unknown as PayloadRequest

    const labels = await achievementsReader(options).badgesFor([ada, ben, cy, ada], req)

    // Ada: Early member beats Verified. Ben: Verified revoked. Cy: unverified.
    expect(labels).toEqual(new Map([["1", "Early member"]]))
    expect(payload.find).toHaveBeenCalledOnce()
    expect(payload.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: { user: { in: ["1", "2", "3"] } } }),
    )
  })

  it("gives nobody a badge while achievements are switched off", async () => {
    enabled.mockResolvedValue(false)
    const { payload } = fakePayload({ rows: rows() })

    const labels = await achievementsReader(options).badgesFor([ada], {
      payload,
    } as unknown as PayloadRequest)

    expect(labels.size).toBe(0)
    expect(payload.find).not.toHaveBeenCalled()
  })

  it("gives nobody a badge when the plugin is disabled in code, whatever the switch", async () => {
    const { payload } = fakePayload({ rows: rows() })
    const labels = await achievementsReader({ ...options, disabled: true }).badgesFor([ada], {
      payload,
    } as unknown as PayloadRequest)
    expect(labels.size).toBe(0)
    expect(enabled).not.toHaveBeenCalled()
  })
})

describe("GET /api/achievements/mine", () => {
  const handler = mineEndpoint(resolveAchievementsConfig(options)).handler
  const call = (payload: unknown) => handler({ payload } as unknown as PayloadRequest)

  it("lists the signed-in reader's achievements, never cached", async () => {
    currentUser.mockResolvedValue(ada)
    const response = await call(fakePayload({ rows: rows() }).payload)

    expect(response.status).toBe(200)
    expect(response.headers.get("Cache-Control")).toBe("private, no-store")
    expect(await response.json()).toEqual({
      achievements: [
        expect.objectContaining({ key: EARLY_MEMBER, earnedAt: "2026-10-18T12:00:00.000Z" }),
        expect.objectContaining({ key: "verified", earnedAt: null }),
      ],
    })
  })

  it("answers 401 for someone signed out, and 404 while switched off", async () => {
    currentUser.mockResolvedValue(null)
    expect((await call(fakePayload().payload)).status).toBe(401)
    enabled.mockResolvedValue(false)
    expect((await call(fakePayload().payload)).status).toBe(404)
  })
})
