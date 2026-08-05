import { describe, expect, it, beforeAll } from "vitest"
import type { Payload } from "payload"
import { getPayload } from "../helpers/testUsers"

describe("anyone access", () => {
  let payload: Payload

  beforeAll(async () => {
    payload = await getPayload()
  })

  describe("anyone (read)", () => {
    it("allows unauthenticated users to read topics", async () => {
      const topic = await payload.create({
        collection: "topics",
        overrideAccess: true,
        draft: true,
        data: { name: "Public Topic Anyone - auth" },
      })

      const result = await payload.findByID({
        collection: "topics",
        id: topic.id,
        overrideAccess: false,
        user: undefined,
      })

      expect(result.id).toBe(topic.id)
    })
  })
})
