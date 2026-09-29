import { beforeEach, describe, expect, it, vi } from "vitest"
import { createOrUpdatePage } from "../pages"

const mockCreate = vi.fn()
const mockUpdate = vi.fn()
const mockFind = vi.fn()

const mockPayload = {
  create: mockCreate,
  update: mockUpdate,
  find: mockFind,
  logger: { warn: vi.fn() },
} as never

const pageData = { title: "About", slug: "about", _status: "published" } as never
const context = { disableRevalidate: true }

beforeEach(() => {
  vi.clearAllMocks()
})

describe("createOrUpdatePage", () => {
  it("creates the page with the caller's context", async () => {
    mockCreate.mockResolvedValueOnce({ id: 1 })

    await expect(createOrUpdatePage(mockPayload, pageData, context)).resolves.toEqual({ id: 1 })
    expect(mockCreate).toHaveBeenCalledWith({ collection: "pages", context, data: pageData })
  })

  it("updates the existing page on a slug conflict, keeping the context", async () => {
    mockCreate.mockRejectedValueOnce(new Error("Value must be unique: slug"))
    mockFind.mockResolvedValueOnce({ docs: [{ id: 4 }] })
    mockUpdate.mockResolvedValueOnce({ id: 4 })

    await expect(createOrUpdatePage(mockPayload, pageData, context)).resolves.toEqual({ id: 4 })
    expect(mockUpdate).toHaveBeenCalledWith({
      collection: "pages",
      id: 4,
      context,
      data: pageData,
    })
  })

  it("rethrows errors that aren't slug conflicts", async () => {
    const failure = new Error("connection refused")
    mockCreate.mockRejectedValueOnce(failure)

    await expect(createOrUpdatePage(mockPayload, pageData, context)).rejects.toBe(failure)
    expect(mockFind).not.toHaveBeenCalled()
  })

  it("rethrows a slug conflict when no existing page turns up", async () => {
    const conflict = new Error("Value must be unique: slug")
    mockCreate.mockRejectedValueOnce(conflict)
    mockFind.mockResolvedValueOnce({ docs: [] })

    await expect(createOrUpdatePage(mockPayload, pageData, context)).rejects.toBe(conflict)
    expect(mockUpdate).not.toHaveBeenCalled()
  })
})
