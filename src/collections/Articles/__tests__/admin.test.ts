// @vitest-environment node
import type { Field } from "payload"
import { afterEach, describe, expect, it, vi } from "vitest"

import { Articles } from "../index"

const PREVIEW =
  "/next/preview?slug=my-article&collection=articles&path=%2Farticles%2Fmy-article&previewSecret=s3cret"

describe("Articles admin", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("previews an article at its own path", () => {
    vi.stubEnv("PREVIEW_SECRET", "s3cret")
    const preview = Articles.admin?.preview

    expect(preview?.({ slug: "my-article" }, { req: {} } as never)).toBe(PREVIEW)
  })

  it("live-previews the same path", () => {
    vi.stubEnv("PREVIEW_SECRET", "s3cret")
    const url = Articles.admin?.livePreview?.url
    if (typeof url !== "function") throw new Error("livePreview.url isn't a function")

    expect(url({ data: { slug: "my-article" }, req: {} } as never)).toBe(PREVIEW)
  })

  it("has no live preview before the article has a slug", () => {
    const url = Articles.admin?.livePreview?.url
    if (typeof url !== "function") throw new Error("livePreview.url isn't a function")

    expect(url({ data: {}, req: {} } as never)).toBeNull()
  })

  it("never lets createdBy be updated", () => {
    const createdBy = Articles.fields.find(
      (field): field is Extract<Field, { type: "relationship" }> =>
        "name" in field && field.name === "createdBy",
    )

    expect(createdBy?.access?.update?.({ req: { user: { roles: ["admin"] } } } as never)).toBe(
      false,
    )
  })
})
