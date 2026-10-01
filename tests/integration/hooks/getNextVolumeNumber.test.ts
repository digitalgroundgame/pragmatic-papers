import type { Payload } from "payload"
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

import { createVolume } from "../helpers/content"
import { getPayload } from "../helpers/testUsers"

vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))

/**
 * `getNextVolumeNumber` is the `volumeNumber` field's default: one more than the highest number
 * any volume has, drafts included, so a new volume never collides with one in progress.
 */
let payload: Payload

beforeAll(async () => {
  payload = await getPayload()
})

// Every test counts from what is in the table, so each starts from an empty one.
beforeEach(async () => {
  await payload.delete({
    collection: "volumes",
    where: { id: { exists: true } },
    overrideAccess: true,
    context: { disableRevalidate: true },
  })
})

describe("getNextVolumeNumber", () => {
  it("numbers the first volume 1", async () => {
    const volume = await createVolume()
    expect(volume.volumeNumber).toBe(1)
  })

  it("numbers the volume after a single one 2", async () => {
    await createVolume()
    const next = await createVolume()
    expect(next.volumeNumber).toBe(2)
  })

  it("follows the highest number, not the count, when numbers have gaps", async () => {
    await createVolume({ volumeNumber: 3 })
    await createVolume({ volumeNumber: 12 })
    await createVolume({ volumeNumber: 7 })

    const next = await createVolume()

    expect(next.volumeNumber).toBe(13)
  })

  it("counts a draft volume as taken", async () => {
    await createVolume({ volumeNumber: 4, _status: "draft" })

    const next = await createVolume()

    expect(next.volumeNumber).toBe(5)
  })

  it("keeps a number the editor typed in", async () => {
    await createVolume({ volumeNumber: 9 })

    const chosen = await createVolume({ volumeNumber: 2 })

    expect(chosen.volumeNumber).toBe(2)
  })
})
