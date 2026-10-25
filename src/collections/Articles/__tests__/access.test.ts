// @vitest-environment node
import { describe, expect, it } from "vitest"

import { canDeleteArticle } from "@/access/policies"
import { keepWritersFromUnpublishing } from "@/collections/Articles/hooks/keepWritersFromUnpublishing"
import { Articles } from "../index"

describe("Articles access", () => {
  it("only editors take a live article down", () => {
    expect(Articles.access?.delete).toBe(canDeleteArticle)
    expect(Articles.hooks?.beforeOperation).toContain(keepWritersFromUnpublishing)
  })
})
