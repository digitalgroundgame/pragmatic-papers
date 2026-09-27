import { describe, expect, it } from "vitest"

import { captureSvgContent, populateCreatedBy } from "@/collections/MapAssets"

// The hooks reach into PayloadRequest and the upload File shape. We only touch the
// fields the hooks actually read, so the casts here are intentional — the runtime
// shape is what matters.
const callCapture = (args: {
  data?: Record<string, unknown>
  file?: { mimetype: string; data: Buffer | string | undefined }
}) =>
  captureSvgContent({
    data: (args.data ?? {}) as never,
    req: { file: args.file as never } as never,
    operation: "create",
    collection: {} as never,
    context: {} as never,
  } as never)

const callPopulate = (args: {
  data?: Record<string, unknown>
  operation: "create" | "update"
  user?: { id: number } | null
}) =>
  populateCreatedBy({
    data: (args.data ?? {}) as never,
    operation: args.operation,
    req: { user: args.user ?? null } as never,
    collection: {} as never,
    context: {} as never,
  } as never)

describe("captureSvgContent", () => {
  it("populates svgContent with the file's utf-8 text for SVG uploads", () => {
    const svg = `<svg viewBox="0 0 1 1"><path d="M0 0"/></svg>`
    const data: Record<string, unknown> = {}
    callCapture({ data, file: { mimetype: "image/svg+xml", data: Buffer.from(svg, "utf8") } })
    expect(data.svgContent).toBe(svg)
  })

  it("does not touch svgContent when the upload is not an SVG", () => {
    const data: Record<string, unknown> = { svgContent: "preexisting" }
    callCapture({
      data,
      file: { mimetype: "application/json", data: Buffer.from("{}", "utf8") },
    })
    expect(data.svgContent).toBe("preexisting")
  })

  it("does nothing when there is no file on the request (e.g. metadata-only update)", () => {
    const data: Record<string, unknown> = {}
    callCapture({ data, file: undefined })
    expect(data.svgContent).toBeUndefined()
  })

  it("handles a file whose data buffer is missing", () => {
    const data: Record<string, unknown> = {}
    callCapture({ data, file: { mimetype: "image/svg+xml", data: undefined } })
    expect(data.svgContent).toBe("")
  })
})

describe("populateCreatedBy", () => {
  it("stamps createdBy with the current user on create", () => {
    const data: Record<string, unknown> = {}
    callPopulate({ data, operation: "create", user: { id: 42 } })
    expect(data.createdBy).toBe(42)
  })

  it("does not overwrite createdBy on update", () => {
    const data: Record<string, unknown> = { createdBy: 7 }
    callPopulate({ data, operation: "update", user: { id: 42 } })
    expect(data.createdBy).toBe(7)
  })

  it("leaves createdBy untouched when there is no authenticated user", () => {
    const data: Record<string, unknown> = {}
    callPopulate({ data, operation: "create", user: null })
    expect(data.createdBy).toBeUndefined()
  })
})
