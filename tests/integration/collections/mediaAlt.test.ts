import type { Payload } from "payload"
import { beforeAll, describe, expect, it } from "vitest"

import type { Media, User } from "@/payload-types"

import { testFile } from "../fixtures/media"
import { createUser, getPayload } from "../helpers/testUsers"

describe("alt text on image uploads", () => {
  let payload: Payload
  let editor: User

  beforeAll(async () => {
    payload = await getPayload()
    editor = await createUser("editor")
  })

  const upload = (data: Partial<Media>, user: User | null = editor) =>
    payload.create({
      collection: "media",
      overrideAccess: !user,
      context: { disableRevalidate: true },
      file: testFile(),
      data: data as Media,
      ...(user ? { user } : {}),
    })

  const edit = (id: number, data: Partial<Media>) =>
    payload.update({
      collection: "media",
      id,
      overrideAccess: false,
      context: { disableRevalidate: true },
      data,
      user: editor,
    })

  it("turns down an editor's image without alt text", async () => {
    await expect(upload({})).rejects.toThrow(/alt/i)
  })

  it("keeps an image saved before alt text was required editable", async () => {
    // A script without a user stands in for an upload from before the check.
    const old = await upload({}, null)
    expect(old.alt ?? null).toBeNull()

    const updated = await edit(old.id, { blurDataURL: "data:image/png;base64,AAAA" })
    expect(updated.blurDataURL).toBe("data:image/png;base64,AAAA")
  })

  it("lets an update that leaves alt text out keep it", async () => {
    const media = await upload({ alt: "A lighthouse at dusk" })

    const updated = await edit(media.id, { blurDataURL: "data:image/png;base64,AAAA" })
    expect(updated.alt).toBe("A lighthouse at dusk")
  })

  it("won't clear alt text that was written", async () => {
    const media = await upload({ alt: "A lighthouse at dusk" })

    await expect(edit(media.id, { alt: "" })).rejects.toThrow(/alt/i)
  })
})
