import type { Access, PayloadRequest, TextField } from "payload"
import { afterEach, describe, expect, it, vi } from "vitest"

import { Docs } from "../collection"

const update = Docs.access!.update as Access
const req = (roles?: string[]) =>
  ({ user: roles ? { id: 1, collection: "users", roles } : null }) as unknown as PayloadRequest

afterEach(() => vi.unstubAllEnvs())

describe("Docs access: update", () => {
  it("refuses anyone below editor", () => {
    expect(update({ req: req() })).toBe(false)
    expect(update({ req: req(["writer"]) })).toBe(false)
  })

  it("lets editors change only docs written in this admin on a deployed site", () => {
    vi.stubEnv("NODE_ENV", "production")
    expect(update({ req: req(["editor"]) })).toEqual({ sourceHash: { exists: false } })
  })

  it("leaves repo docs editable in local dev, where docs:export reads them", () => {
    vi.stubEnv("NODE_ENV", "development")
    expect(update({ req: req(["editor"]) })).toBe(true)
  })
})

describe("Docs fields: sourceHash", () => {
  const field = Docs.fields.find((f) => "name" in f && f.name === "sourceHash") as TextField
  const condition = field.admin!.condition!

  it("shows only on a doc that came from the repo", () => {
    const args = {} as Parameters<typeof condition>[2]
    expect(condition({ sourceHash: "abc" }, {}, args)).toBe(true)
    expect(condition({}, {}, args)).toBe(false)
  })
})

describe("Docs admin: preview", () => {
  it("previews a doc at /docs/<slug>", () => {
    const previewReq = { headers: new Headers() } as unknown as PayloadRequest
    const preview = Docs.admin!.preview!(
      { slug: "experiments" },
      {
        req: previewReq,
        locale: "",
        token: null,
      },
    )
    const live = Docs.admin!.livePreview!.url as (args: unknown) => string | null
    for (const url of [preview, live({ data: { slug: "experiments" }, req: previewReq })]) {
      expect(String(url)).toContain("slug=experiments")
      expect(String(url)).toContain(encodeURIComponent("/docs/experiments"))
    }
  })
})
