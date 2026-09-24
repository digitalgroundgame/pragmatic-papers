import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createVolumes } from "../volumes"

const mockCreate = vi.fn()
const mockUpdate = vi.fn()
const mockFind = vi.fn()

const mockPayload = {
  create: mockCreate,
  update: mockUpdate,
  find: mockFind,
  logger: { warn: vi.fn() },
} as never

const volumeConfig = {
  volumeNumber: 1,
  title: "Volume 1",
  description: "The first volume.",
  editorsNoteContent: "A note from the editors.",
  articleIds: [10, 11],
}

const context = { disableRevalidate: true }

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  vi.useRealTimers()
})

describe("createVolumes", () => {
  it("creates each volume with the caller's context", async () => {
    mockCreate.mockResolvedValueOnce({ id: 1 })

    const { volumes } = await createVolumes(mockPayload, [volumeConfig], [], context)

    expect(volumes).toEqual([{ id: 1 }])
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: "volumes",
        context,
        data: expect.objectContaining({ slug: "1", articles: [10, 11], _status: "published" }),
      }),
    )
  })

  it("updates the existing volume on a slug conflict, keeping the context", async () => {
    mockCreate.mockRejectedValueOnce(new Error("Value must be unique: slug"))
    mockFind.mockResolvedValueOnce({ docs: [{ id: 7 }] })
    mockUpdate.mockResolvedValueOnce({ id: 7 })

    const { volumes } = await createVolumes(mockPayload, [volumeConfig], [], context)

    expect(volumes).toEqual([{ id: 7 }])
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ collection: "volumes", id: 7, context }),
    )
  })

  it("rethrows a slug conflict when no existing volume turns up", async () => {
    const conflict = new Error("Value must be unique: slug")
    mockCreate.mockRejectedValueOnce(conflict)
    mockFind.mockResolvedValueOnce({ docs: [] })

    await expect(createVolumes(mockPayload, [volumeConfig], [], context)).rejects.toBe(conflict)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it("falls back to scalar fields on the last attempt, keeping the context", async () => {
    vi.useFakeTimers()
    mockCreate
      .mockRejectedValueOnce(new Error("Cannot read properties of undefined (reading '_uuid')"))
      .mockRejectedValueOnce(new Error("Cannot read properties of undefined (reading '_uuid')"))
      .mockResolvedValueOnce({ id: 3 })

    const result = createVolumes(mockPayload, [volumeConfig], [], context)
    await vi.runAllTimersAsync()

    expect(await result).toEqual({ volumes: [{ id: 3 }] })
    const lastCall = mockCreate.mock.calls[2]![0]
    expect(lastCall.context).toBe(context)
    expect(lastCall.data).not.toHaveProperty("articles")
    expect(lastCall.data).not.toHaveProperty("editorsNote")
  })

  it("gives up after three failed attempts", async () => {
    vi.useFakeTimers()
    mockCreate.mockRejectedValue(new Error("adapter reset"))

    const result = createVolumes(mockPayload, [volumeConfig], [], context)
    const assertion = expect(result).rejects.toThrow('Failed to create volume "1" after 3 attempts')
    await vi.runAllTimersAsync()

    await assertion
    expect(mockCreate).toHaveBeenCalledTimes(3)
  })
})
