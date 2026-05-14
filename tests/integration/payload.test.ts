import { getPayloadConfig } from "@/utilities/getPayloadConfig"
import type { Payload } from "payload"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

describe("Payload database", () => {
  let payload: Payload

  beforeAll(async () => {
    payload = await getPayloadConfig()
  })

  afterAll(async () => {
    await payload.db.destroy?.()
  })

  it("connects and returns a valid find result from the users collection", async () => {
    const result = await payload.find({
      collection: "users",
      limit: 1,
      overrideAccess: true,
    })

    expect(result).toMatchObject({
      docs: expect.any(Array),
      totalDocs: expect.any(Number),
      limit: 1,
      totalPages: expect.any(Number),
      page: expect.any(Number),
      pagingCounter: expect.any(Number),
      hasPrevPage: expect.any(Boolean),
      hasNextPage: expect.any(Boolean),
    })
  })
})
