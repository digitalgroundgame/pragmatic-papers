import type { Payload } from "payload"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"

import type { Volume } from "@/payload-types"
import { createVolume } from "../helpers/content"
import { getPayload } from "../helpers/testUsers"

vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))

const { revalidatePath, revalidateTag } = await import("next/cache")

/**
 * The volume hooks in `src/collections/Volumes/hooks/revalidateVolumes.ts`, run by Payload on a
 * real save: a published volume refreshes its page, the volumes feed and the sitemap; a draft
 * that was never published touches nothing.
 */
let payload: Payload

const paths = (): string[] => vi.mocked(revalidatePath).mock.calls.map(([path]) => path)

beforeAll(async () => {
  payload = await getPayload()
})

afterEach(() => {
  vi.clearAllMocks()
})

function update(volume: Volume, data: Partial<Volume>, draft = false): Promise<Volume> {
  return payload.update({
    collection: "volumes",
    id: volume.id,
    overrideAccess: true,
    draft,
    data,
  })
}

describe("revalidateVolumes (afterChange)", () => {
  it("refreshes a published volume's page, the feed and the sitemap", async () => {
    const volume = await createVolume()

    await update(volume, { title: "Retitled" })

    expect(paths()).toEqual([`/volumes/${volume.slug}`, "/volumes/feed.xml"])
    expect(revalidateTag).toHaveBeenCalledWith("volumes-sitemap", "max")
  })

  it("refreshes the old page when a published volume goes back to draft", async () => {
    const volume = await createVolume()

    await update(volume, { _status: "draft" })

    expect(paths()).toEqual([`/volumes/${volume.slug}`, "/volumes/feed.xml"])
  })

  it("leaves a draft that was never published alone", async () => {
    const draft = await createVolume({ _status: "draft" })

    await update(draft, { title: "Still a draft" }, true)

    expect(paths()).toEqual([])
    expect(revalidateTag).not.toHaveBeenCalled()
  })

  it("skips everything when the caller turns revalidation off", async () => {
    const volume = await createVolume()

    await payload.update({
      collection: "volumes",
      id: volume.id,
      overrideAccess: true,
      context: { disableRevalidate: true },
      data: { title: "Quiet edit" },
    })

    expect(paths()).toEqual([])
  })
})

describe("revalidateDelete (afterDelete)", () => {
  it("refreshes the deleted volume's page, the feed and the sitemap", async () => {
    const volume = await createVolume()

    await payload.delete({ collection: "volumes", id: volume.id, overrideAccess: true })

    expect(paths()).toEqual([`/volumes/${volume.slug}`, "/volumes/feed.xml"])
    expect(revalidateTag).toHaveBeenCalledWith("volumes-sitemap", "max")
  })
})
