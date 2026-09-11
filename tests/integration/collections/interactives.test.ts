import type { Payload } from "payload"
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"

import { createFederalCourtsInteractive } from "@/endpoints/seed/features/interactives"
import { composeOverview } from "@/interactives/compose"
import { validateDrilldownData } from "@/interactives/contract"
import { loadFederalCourtsGeometry } from "@/interactives/federal-courts/geometry"
import { federalCourtsPresentation } from "@/interactives/federal-courts/presentation"
import type { DrilldownData } from "@/interactives/types"
import { getPayloadConfig } from "@/utilities/getPayloadConfig"

let payload: Payload
let interactiveId: number | null = null

beforeAll(async () => {
  payload = await getPayloadConfig()
})

afterAll(async () => {
  await payload.db.destroy?.()
})

afterEach(async () => {
  if (interactiveId == null) return
  await payload.delete({
    collection: "interactive-snapshots",
    where: { interactive: { equals: interactiveId } },
    overrideAccess: true,
    context: { disableRevalidate: true },
  })
  await payload.delete({
    collection: "interactives",
    id: interactiveId,
    overrideAccess: true,
    context: { disableRevalidate: true },
  })
  interactiveId = null
})

/**
 * The seed is the only thing that stands the Federal Courts page up in dev and in the e2e
 * environment, so this runs it for real: the fixture is a genuine adapter output, and it has
 * to survive validation against the committed geometry and compose into a renderable overview.
 */
describe("seed — Federal Courts interactive", () => {
  it("creates a published page and a published snapshot readers can see", async () => {
    interactiveId = await createFederalCourtsInteractive(payload, { disableRevalidate: true })

    // What an anonymous reader gets.
    const { docs: pages } = await payload.find({
      collection: "interactives",
      where: { slug: { equals: "federal-courts" } },
      overrideAccess: false,
      draft: false,
    })
    expect(pages).toHaveLength(1)
    expect(pages[0]).toMatchObject({
      id: interactiveId,
      title: "Federal Court Appointment Tracker",
      profile: "federal-courts",
      _status: "published",
      feed: { enabled: true, ref: "release", autoPublish: false },
    })
    expect(pages[0]?.sources?.length).toBeGreaterThan(0)

    const { docs: snapshots } = await payload.find({
      collection: "interactive-snapshots",
      where: { interactive: { equals: interactiveId } },
      overrideAccess: false,
      draft: false,
      depth: 0,
    })
    expect(snapshots).toHaveLength(1)
    expect(snapshots[0]).toMatchObject({
      _status: "published",
      sourceVersion: expect.any(String),
      contentHash: expect.stringMatching(/^[0-9a-f]{16}$/),
    })
    expect(snapshots[0]?.summary).toMatch(/regions · .* records · datasets:/)
  })

  it("seeds data that validates and composes into the overview the page renders", async () => {
    interactiveId = await createFederalCourtsInteractive(payload, { disableRevalidate: true })
    const { docs } = await payload.find({
      collection: "interactive-snapshots",
      where: { interactive: { equals: interactiveId } },
      overrideAccess: true,
      depth: 0,
    })
    const geometry = await loadFederalCourtsGeometry()
    const { data, errors } = validateDrilldownData(docs[0]?.data, geometry)
    expect(errors).toEqual([])

    const overview = composeOverview({
      presentation: federalCourtsPresentation,
      geometry,
      data: data as DrilldownData,
    })
    expect(overview.viewBox).not.toBeNull()
    expect(overview.payloadError).toBeNull()
    // Every circuit is drillable, so only the courts with no child asset are served here.
    expect(overview.payload?.records?.items.length).toBeGreaterThan(0)
    expect(overview.payload?.records?.display).toBe(federalCourtsPresentation.display)
    expect(overview.payload?.seats).toBe(federalCourtsPresentation.seats)
    // Geometry contributes shapes only; every fact a reader sees came from the feed.
    expect(overview.paths.every((p) => Object.keys(p.facts).length === 0)).toBe(true)
  })
})

/**
 * What the admin does when an editor presses Publish, and what would happen if the snapshot's
 * megabyte stopped being part of that form.
 *
 * The field is the reason two 1 MB walls have been hit — a Server Action's body limit and
 * busboy's field limit, which truncates rather than refuses. Keeping it out of the form is the
 * fix that makes both go away, and this is the question that decides whether that is safe: a
 * publish writes a *version* from the document, so if an update that omits the field emptied
 * it, every publish would quietly publish nothing.
 */
describe("interactive snapshots — publishing a document that carries a megabyte", () => {
  it("keeps the data an update does not mention, in the document and in its version", async () => {
    interactiveId = await createFederalCourtsInteractive(payload, { disableRevalidate: true })
    const { docs } = await payload.find({
      collection: "interactive-snapshots",
      where: { interactive: { equals: interactiveId } },
      draft: true,
      depth: 0,
      overrideAccess: true,
    })
    const snapshot = docs[0]!
    const before = snapshot.data as { regions?: unknown[] }
    expect(before?.regions?.length).toBeGreaterThan(100)

    // Exactly what a form without that field would send: everything else, and a status.
    const updated = await payload.update({
      collection: "interactive-snapshots",
      id: snapshot.id,
      data: { label: snapshot.label, summary: snapshot.summary, _status: "published" },
      overrideAccess: true,
      context: { disableRevalidate: true },
    })
    expect((updated.data as { regions?: unknown[] })?.regions?.length).toBe(before.regions!.length)

    // And what a reader is served, which comes from the published version rather than the row.
    const { docs: published } = await payload.find({
      collection: "interactive-snapshots",
      where: { interactive: { equals: interactiveId } },
      depth: 0,
      overrideAccess: false,
    })
    expect((published[0]?.data as { regions?: unknown[] })?.regions?.length).toBe(
      before.regions!.length,
    )
  })
})
