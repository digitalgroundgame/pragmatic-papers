import type { Payload } from "payload"
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"

import { getPayloadClient } from "@/data/payload"
import { createSenateLeaderWhipCount, WHIP_COUNT_SLUG } from "@/endpoints/seed/features/whip-count"
import type { WhipCountData } from "@/interactives/whip-count/model"
import type { InteractiveSnapshot, User } from "@/payload-types"

import { createUser } from "../helpers/testUsers"

let payload: Payload
let editor: User
let writer: User
const context = { disableRevalidate: true }

beforeAll(async () => {
  payload = await getPayloadClient()
  editor = await createUser("editor")
  writer = await createUser("writer")
})

afterAll(async () => {
  await payload.delete({
    collection: "users",
    where: { id: { in: [editor.id, writer.id] } },
    overrideAccess: true,
    context,
  })
  await payload.db.destroy?.()
})

afterEach(async () => {
  const { docs } = await payload.find({
    collection: "interactives",
    where: { slug: { in: [WHIP_COUNT_SLUG, "a-map"] } },
    draft: true,
    depth: 0,
  })
  const ids = docs.map((doc) => doc.id)
  if (ids.length === 0) return
  await payload.delete({
    collection: "interactive-snapshots",
    where: { interactive: { in: ids } },
    context,
  })
  await payload.delete({ collection: "interactives", where: { id: { in: ids } }, context })
})

const snapshotOf = async (slug: string): Promise<InteractiveSnapshot> => {
  const { docs } = await payload.find({
    collection: "interactive-snapshots",
    where: { "interactive.slug": { equals: slug } },
    draft: true,
    depth: 0,
  })
  return docs[0]!
}

describe("whip count snapshots", () => {
  it("are what an anonymous reader finds by the interactive's slug", async () => {
    await createSenateLeaderWhipCount(payload, context)

    // The query the scheduled research task reads the count with.
    const { docs } = await payload.find({
      collection: "interactive-snapshots",
      where: { "interactive.slug": { equals: WHIP_COUNT_SLUG } },
      overrideAccess: false,
      draft: false,
      depth: 0,
    })
    expect(docs).toHaveLength(1)
    const data = docs[0]!.data as unknown as WhipCountData
    expect(data.schema).toBe("pragmatic-papers/whip-count@1")
    expect(docs[0]).toMatchObject({ sourceRef: "seed", sourceVersion: data.asOf })
  })

  it("let an editor change the count, restamping it, and nobody else", async () => {
    await createSenateLeaderWhipCount(payload, context)
    const snapshot = await snapshotOf(WHIP_COUNT_SLUG)
    const count = snapshot.data as unknown as WhipCountData
    const changed = { ...count, asOf: "2026-11-20" }

    const updated = await payload.update({
      collection: "interactive-snapshots",
      id: snapshot.id,
      data: { data: changed, sourceVersion: "tampered" },
      user: editor,
      overrideAccess: false,
      draft: true,
      context,
    })
    expect((updated.data as unknown as WhipCountData).asOf).toBe("2026-11-20")
    // Provenance comes from the count, not from what the editor sent.
    expect(updated.sourceVersion).toBe("2026-11-20")
    expect(updated.contentHash).not.toBe(snapshot.contentHash)

    await expect(
      payload.update({
        collection: "interactive-snapshots",
        id: snapshot.id,
        data: { data: changed },
        user: writer,
        overrideAccess: false,
        context,
      }),
    ).rejects.toThrow()
  })

  it("can't be turned into something the page can't draw", async () => {
    await createSenateLeaderWhipCount(payload, context)
    const snapshot = await snapshotOf(WHIP_COUNT_SLUG)
    await expect(
      payload.update({
        collection: "interactive-snapshots",
        id: snapshot.id,
        data: { data: { schema: "something else" } },
        user: editor,
        overrideAccess: false,
        context,
      }),
    ).rejects.toMatchObject({
      data: { errors: [{ path: "data", message: expect.stringContaining('"schema" must be') }] },
    })
  })

  it("can be created by an editor only for a whip count", async () => {
    const map = await payload.create({
      collection: "interactives",
      data: { title: "A map", slug: "a-map", profile: "federal-courts", _status: "draft" },
      context,
    })
    await expect(
      payload.create({
        collection: "interactive-snapshots",
        data: {
          label: "By hand",
          interactive: map.id,
          sourceVersion: "v1",
          sourceRef: "hand",
          contentHash: "x",
          generatedAt: new Date().toISOString(),
          syncedAt: new Date().toISOString(),
          data: { schema: "pragmatic-papers/drilldown-data@1" },
        },
        user: editor,
        overrideAccess: false,
        context,
      }),
    ).rejects.toThrow()
  })
})
