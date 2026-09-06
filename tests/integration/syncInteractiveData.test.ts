import type { Payload } from "payload"
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest"

import {
  DEFAULT_JUDGE,
  miniCourtTracker,
} from "@/interactives/federal-courts/__tests__/miniUpstream"
import { findLatestSnapshot, syncInteractive } from "@/jobs/syncInteractiveData/logic"
import type { Interactive } from "@/payload-types"
import { getPayloadConfig } from "@/utilities/getPayloadConfig"

import { createUser } from "./helpers/testUsers"

let payload: Payload
const silentLog = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
const created: number[] = []

beforeAll(async () => {
  payload = await getPayloadConfig()
})

afterAll(async () => {
  await payload.db.destroy?.()
})

afterEach(async () => {
  if (created.length === 0) return
  await payload.delete({
    collection: "interactive-snapshots",
    where: { interactive: { in: created } },
    overrideAccess: true,
    context: { disableRevalidate: true },
  })
  await payload.delete({
    collection: "interactives",
    where: { id: { in: created } },
    overrideAccess: true,
    context: { disableRevalidate: true },
  })
  created.length = 0
})

const upstream = (version: string, judgeStatus: "active" | "senior" = "active") =>
  miniCourtTracker({
    version,
    judges: [
      {
        ...DEFAULT_JUDGE,
        status: judgeStatus,
        senior_date: judgeStatus === "senior" ? "2026-01-01" : null,
      },
    ],
  })

async function createInteractive(over: Partial<Interactive["feed"]> = {}): Promise<Interactive> {
  const doc = await payload.create({
    collection: "interactives",
    overrideAccess: true,
    context: { disableRevalidate: true },
    data: {
      title: `Integration Interactive ${Date.now()}`,
      slug: `integration-interactive-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
      profile: "federal-courts",
      feed: { enabled: true, ref: "main", autoPublish: false, ...over },
      _status: "published",
    },
  })
  created.push(doc.id)
  return doc
}

async function publicSnapshots(interactiveId: number) {
  return payload.find({
    collection: "interactive-snapshots",
    where: { interactive: { equals: interactiveId } },
    overrideAccess: false,
    draft: false,
  })
}

describe("syncInteractive against a real database", () => {
  it("writes a draft the public cannot read until an editor publishes it", async () => {
    const interactive = await createInteractive()
    const first = await syncInteractive(payload, interactive, {
      log: silentLog,
      files: await upstream("v1"),
    })
    expect(first).toMatchObject({ outcome: "synced", status: "draft" })

    // Nothing published yet: readers get nothing, staff see the draft.
    expect((await publicSnapshots(interactive.id)).totalDocs).toBe(0)
    const latest = await findLatestSnapshot(payload, interactive.id)
    expect(latest).toMatchObject({
      _status: "draft",
      sourceVersion: "v1",
      summary: "110 regions · 1 records",
    })

    // An editor publishes from the admin — only the status changes; the fields are sync-owned.
    const editor = await createUser("editor")
    await payload.update({
      collection: "interactive-snapshots",
      id: latest!.id,
      user: editor,
      overrideAccess: false,
      context: { disableRevalidate: true },
      data: { _status: "published" },
    })
    const published = await publicSnapshots(interactive.id)
    expect(published.totalDocs).toBe(1)
    expect(published.docs[0]).toMatchObject({
      sourceVersion: "v1",
      contentHash: latest!.contentHash,
    })
    expect((published.docs[0]!.data as { records: unknown[] }).records).toHaveLength(1)
  })

  it("leaves the published version serving while a changed feed waits as a new draft", async () => {
    const interactive = await createInteractive({ autoPublish: true })
    const first = await syncInteractive(payload, interactive, {
      log: silentLog,
      files: await upstream("v1"),
    })
    expect(first).toMatchObject({ outcome: "synced", status: "published" })
    const live = (await publicSnapshots(interactive.id)).docs[0]!

    // Same stamp: no read, no write.
    expect(
      await syncInteractive(payload, interactive, { log: silentLog, files: await upstream("v1") }),
    ).toEqual({
      outcome: "unchanged",
      reason: "source-version",
    })

    // The judge takes senior status upstream; the interactive no longer auto-publishes.
    const reviewed = await payload.update({
      collection: "interactives",
      id: interactive.id,
      overrideAccess: true,
      context: { disableRevalidate: true },
      data: { feed: { enabled: true, ref: "main", autoPublish: false } },
    })
    const second = await syncInteractive(payload, reviewed, {
      log: silentLog,
      files: await upstream("v2", "senior"),
    })
    expect(second).toMatchObject({ outcome: "synced", status: "draft", sourceVersion: "v2" })

    const stillLive = (await publicSnapshots(interactive.id)).docs[0]!
    expect(stillLive.id).toBe(live.id)
    expect(stillLive.sourceVersion).toBe("v1")
    expect(stillLive.contentHash).toBe(live.contentHash)

    const latest = await findLatestSnapshot(payload, interactive.id)
    expect(latest).toMatchObject({ id: live.id, _status: "draft", sourceVersion: "v2" })
    expect(latest!.contentHash).not.toBe(live.contentHash)
  })

  it("rejects a hand-made snapshot and an editor's edit of a sync-owned field", async () => {
    const interactive = await createInteractive()
    const editor = await createUser("editor")
    await expect(
      payload.create({
        collection: "interactive-snapshots",
        user: editor,
        overrideAccess: false,
        data: {
          label: "x",
          interactive: interactive.id,
          sourceVersion: "x",
          contentHash: "x",
          generatedAt: "2026-01-01T00:00:00Z",
          syncedAt: "2026-01-01T00:00:00Z",
          data: {},
        },
      }),
    ).rejects.toThrow()

    await syncInteractive(payload, interactive, { log: silentLog, files: await upstream("v1") })
    const latest = (await findLatestSnapshot(payload, interactive.id))!
    const tampered = await payload.update({
      collection: "interactive-snapshots",
      id: latest.id,
      user: editor,
      overrideAccess: false,
      draft: true,
      context: { disableRevalidate: true },
      data: { sourceVersion: "forged", _status: "draft" },
    })
    expect(tampered.sourceVersion).toBe("v1")
  })
})
