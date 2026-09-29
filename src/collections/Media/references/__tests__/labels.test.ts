import { describe, expect, it } from "vitest"

import type { MediaReference } from "../collectMediaReferences"
import {
  adminUrl,
  collectionLabel,
  describeRefusal,
  fieldLabel,
  groupByDocument,
  NAMED_IN_REFUSAL,
} from "../labels"

const ref = (
  docId: number,
  docTitle: string,
  field = "heroImage",
  collection = "articles",
): MediaReference => ({ collection, field, docId, docTitle })

describe("collectionLabel", () => {
  it("names each collection in the singular", () => {
    expect(collectionLabel("articles")).toBe("Article")
    expect(collectionLabel("users")).toBe("User")
    expect(collectionLabel("interactives")).toBe("Interactive")
  })

  it("capitalises a collection it doesn't know", () => {
    expect(collectionLabel("widgets")).toBe("Widgets")
  })
})

describe("fieldLabel", () => {
  it("reads upload fields as an editor would", () => {
    expect(fieldLabel("heroImage")).toBe("hero image")
    expect(fieldLabel("meta.image")).toBe("SEO image")
    expect(fieldLabel("profileImage")).toBe("profile image")
  })

  it("drops the block types from a rich text or layout field", () => {
    expect(fieldLabel("content (mediaBlock, timeline)")).toBe("content")
    expect(fieldLabel("layout (timeline)")).toBe("page layout")
    expect(fieldLabel("editorsNote (mediaBlock)")).toBe("editor's note")
  })

  it("passes through a field it doesn't know", () => {
    expect(fieldLabel("gallery")).toBe("gallery")
  })
})

describe("adminUrl", () => {
  it("links to the document in the admin", () => {
    expect(adminUrl({ collection: "pages", docId: 5 })).toBe("/admin/collections/pages/5")
  })
})

describe("groupByDocument", () => {
  it("lists each document once with every field that uses the media", () => {
    expect(
      groupByDocument([
        ref(1, "Hero", "heroImage"),
        ref(1, "Hero", "meta.image"),
        ref(1, "Hero", "content (mediaBlock)"),
        ref(1, "Ada", "profileImage", "users"),
      ]),
    ).toEqual([
      {
        collection: "articles",
        docId: 1,
        docTitle: "Hero",
        fields: ["hero image", "SEO image", "content"],
      },
      { collection: "users", docId: 1, docTitle: "Ada", fields: ["profile image"] },
    ])
  })

  it("names a field once even if it holds the media in several blocks", () => {
    const [document] = groupByDocument([
      ref(1, "Body", "content (mediaBlock)"),
      ref(1, "Body", "content (timeline)"),
    ])
    expect(document?.fields).toEqual(["content"])
  })
})

describe("describeRefusal", () => {
  it("names the one document and says what to do", () => {
    expect(describeRefusal([ref(1, "Hero"), ref(1, "Hero", "meta.image")])).toBe(
      "Can't delete: it's used in \"Hero\" (article hero image, SEO image). Replace or remove it there first.",
    )
  })

  it("names every document when there are few", () => {
    expect(
      describeRefusal([ref(1, "One"), ref(2, "Two"), ref(3, "Ada", "profileImage", "users")]),
    ).toBe(
      "Can't delete: it's used in 3 published documents: \"One\" (article hero image), " +
        '"Two" (article hero image) and "Ada" (user profile image). ' +
        "Replace or remove it there first; the References tab lists them all.",
    )
  })

  it("names the first few and counts the rest", () => {
    const refs = Array.from({ length: NAMED_IN_REFUSAL + 2 }, (_, i) => ref(i + 1, `Doc ${i + 1}`))

    const message = describeRefusal(refs)

    expect(message).toContain(`used in ${NAMED_IN_REFUSAL + 2} published documents`)
    expect(message).toContain('"Doc 3" (article hero image) and 2 more.')
    expect(message).not.toContain("Doc 4")
    expect(message).toContain("the References tab lists them all")
  })
})
