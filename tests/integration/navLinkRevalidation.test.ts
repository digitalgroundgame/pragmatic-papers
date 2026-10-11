import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import type { Payload } from "payload"

import type { Page, Topic } from "@/payload-types"

import { ARTICLE_CONTENT } from "./fixtures/content"
import { getPayload } from "./helpers/testUsers"

// The Header and Footer globals cache their nav with linked documents populated, so a
// rename, unpublish or delete of a linked page or topic must drop both globals' caches. This
// drives the real collections, so a hook that's written but never registered fails here.
const { revalidateTag } = vi.hoisted(() => ({ revalidateTag: vi.fn() }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag }))

const navRevalidated = (): boolean =>
  ["global_header", "global_footer"].every((tag) =>
    revalidateTag.mock.calls.some(([called, profile]) => called === tag && profile?.expire === 0),
  )

describe("nav links follow the documents they point at", () => {
  let payload: Payload

  beforeAll(async () => {
    payload = await getPayload()
  })

  beforeEach(() => {
    revalidateTag.mockClear()
  })

  it("drops the nav caches when a linked page is renamed, unpublished and deleted", async () => {
    const page = await payload.create({
      collection: "pages",
      overrideAccess: true,
      context: { disableRevalidate: true },
      data: {
        title: "Nav Target",
        slug: "nav-target",
        layout: [{ blockType: "content", columns: [{ size: "full", richText: ARTICLE_CONTENT }] }],
        _status: "published",
      } as unknown as Page,
    })
    // Header and Footer read pages with only `title`, `slug` and `_status` populated.
    const header = await payload.updateGlobal({
      slug: "header",
      overrideAccess: true,
      context: { disableRevalidate: true },
      data: {
        navItems: [
          {
            link: {
              type: "reference",
              label: "Target",
              reference: { relationTo: "pages", value: page.id },
            },
          },
        ],
      },
      depth: 1,
    })
    const populated = header.navItems?.[0]?.link?.reference?.value
    expect(populated).toMatchObject({ slug: "nav-target", _status: "published" })

    await payload.update({
      collection: "pages",
      id: page.id,
      overrideAccess: true,
      data: { slug: "nav-target-renamed" },
    })
    expect(navRevalidated()).toBe(true)

    revalidateTag.mockClear()
    await payload.update({
      collection: "pages",
      id: page.id,
      overrideAccess: true,
      data: { _status: "draft" },
    })
    expect(navRevalidated()).toBe(true)

    revalidateTag.mockClear()
    await payload.delete({ collection: "pages", id: page.id, overrideAccess: true })
    expect(navRevalidated()).toBe(true)
  })

  it("drops the nav caches when a topic is renamed, and not for an unrelated edit", async () => {
    const topic = await payload.create({
      collection: "topics",
      overrideAccess: true,
      context: { disableRevalidate: true },
      data: { name: "Nav Topic", slug: "nav-topic" } as unknown as Topic,
    })

    await payload.update({
      collection: "topics",
      id: topic.id,
      overrideAccess: true,
      data: { description: "No slug change" },
    })
    expect(navRevalidated()).toBe(false)

    await payload.update({
      collection: "topics",
      id: topic.id,
      overrideAccess: true,
      data: { slug: "nav-topic-renamed" },
    })
    expect(navRevalidated()).toBe(true)
  })
})
