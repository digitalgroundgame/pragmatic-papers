import type { Payload } from "payload"
import { beforeAll, describe, expect, it } from "vitest"

import { createVolume } from "./helpers/content"
import { getPayload } from "./helpers/testUsers"

/**
 * How Payload's `find` treats `limit` when `pagination` is off, on the real database. Sitemaps,
 * the docs tree and other full lists rely on it: `limit` still caps the list, and 0 lifts it.
 */
let payload: Payload
let ids: number[]

beforeAll(async () => {
  payload = await getPayload()
  // One at a time: each takes the next free volume number.
  ids = []
  for (let i = 0; i < 3; i++) ids.push((await createVolume()).id)
})

const find = (limit?: number) =>
  payload.find({
    collection: "volumes",
    depth: 0,
    pagination: false,
    where: { id: { in: ids } },
    ...(limit === undefined ? {} : { limit }),
  })

describe("payload.find with pagination: false", () => {
  it("still stops at the limit", async () => {
    expect((await find(2)).docs).toHaveLength(2)
  })

  it("returns every match with limit 0", async () => {
    expect((await find(0)).docs).toHaveLength(3)
  })

  it("returns every match with no limit", async () => {
    expect((await find()).docs).toHaveLength(3)
  })
})
