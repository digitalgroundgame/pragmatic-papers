// @vitest-environment node
import type { Field } from "payload"
import { describe, expect, it } from "vitest"

import { detectMathBlocks } from "@/collections/Articles/hooks/detectMathBlocks"
import { generateFootnotes } from "@/collections/Articles/hooks/generateFootnotes"
import { grantAuthorsPublicProfile } from "@/collections/Articles/hooks/grantAuthorsPublicProfile"
import { populateMetaImageFromHero } from "@/collections/Articles/hooks/populateMetaImageFromHero"
import { revalidateArticle } from "@/collections/Articles/hooks/revalidateArticle"
import { setCreatedBy } from "@/collections/Articles/hooks/setCreatedBy"
import { setPublishedAtDefault } from "@/collections/Articles/hooks/setPublishedAtDefault"
import { revalidateNavLinks } from "@/hooks/revalidateNavLinks"
import { rememberReadersCopy } from "@/utilities/readersCopy"
import { Articles } from "../index"

describe("Articles hooks", () => {
  it("remembers the readers' copy first, then records the creator before the content hooks", () => {
    expect(Articles.hooks?.beforeChange).toEqual([
      rememberReadersCopy,
      setCreatedBy,
      generateFootnotes,
      detectMathBlocks,
      populateMetaImageFromHero,
    ])
  })

  it("grants public profiles after revalidating", () => {
    expect(Articles.hooks?.afterChange).toEqual([
      revalidateArticle,
      revalidateNavLinks,
      grantAuthorsPublicProfile,
    ])
  })

  it("defaults publishedAt on the field itself", () => {
    const publishedAt = Articles.fields.find(
      (field): field is Extract<Field, { type: "date" }> =>
        "name" in field && field.name === "publishedAt",
    )

    expect(publishedAt?.hooks?.beforeChange).toEqual([setPublishedAtDefault])
  })
})
