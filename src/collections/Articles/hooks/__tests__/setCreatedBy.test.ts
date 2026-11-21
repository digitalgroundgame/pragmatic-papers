// @vitest-environment node
import type { Article } from "@/payload-types"
import { describe, expect, it } from "vitest"

import { setCreatedBy } from "../setCreatedBy"

const run = (
  operation: "create" | "update",
  data: Partial<Article>,
  user: { id: number } | null = { id: 7 },
) => setCreatedBy({ operation, data, req: { user } } as never)

describe("setCreatedBy", () => {
  it("records the signed-in user on create", () => {
    const data: Partial<Article> = { title: "T" }

    expect(run("create", data)).toBe(data)
    expect(data).toEqual({ title: "T", createdBy: 7 })
  })

  it("replaces a createdBy the request sent on create", () => {
    const data: Partial<Article> = { createdBy: 99 }

    run("create", data)

    expect(data.createdBy).toBe(7)
  })

  it("leaves a create without a user alone", () => {
    const data: Partial<Article> = { title: "T" }

    expect(run("create", data, null)).toBeUndefined()
    expect(data).toEqual({ title: "T" })
  })

  it("leaves updates alone", () => {
    const data: Partial<Article> = { title: "T", createdBy: 3 }

    expect(run("update", data)).toBeUndefined()
    expect(data).toEqual({ title: "T", createdBy: 3 })
  })
})
