import { describe, expect, it } from "vitest"

import type { HelpDoc } from "@/docs"
import type { User } from "@/payload-types"

import { helpDocsFor, readFromPreference, unreadHelpDocs } from "../unread"

const doc = (slug: string, publishedAt: string, audience?: HelpDoc["audience"]): HelpDoc => ({
  slug,
  title: slug,
  summary: "",
  publishedAt,
  audience,
})

const user = (...roles: string[]): User => ({ roles }) as unknown as User

const everyone = doc("everyone", "2026-10-18")
const editors = doc("editors", "2026-10-18", ["editor"])
const admins = doc("admins", "2026-10-18", ["admin"])
const docs = [everyone, editors, admins]

const slugs = (list: HelpDoc[]): string[] => list.map((d) => d.slug)

describe("helpDocsFor", () => {
  it("shows a writer the articles for all staff only", () => {
    expect(slugs(helpDocsFor(docs, user("writer")))).toEqual(["everyone"])
  })

  it("shows an editor the editors' articles too", () => {
    expect(slugs(helpDocsFor(docs, user("editor")))).toEqual(["everyone", "editors"])
  })

  it("shows admins and chief editors everything", () => {
    expect(slugs(helpDocsFor(docs, user("admin")))).toEqual(["everyone", "editors", "admins"])
    expect(slugs(helpDocsFor(docs, user("chief-editor")))).toEqual([
      "everyone",
      "editors",
      "admins",
    ])
  })

  it("shows members and logged-out visitors nothing", () => {
    expect(helpDocsFor(docs, user("member"))).toEqual([])
    expect(helpDocsFor(docs, null)).toEqual([])
  })
})

describe("unreadHelpDocs", () => {
  const older = doc("older", "2026-09-01")

  it("counts what hasn't been opened", () => {
    expect(unreadHelpDocs([everyone, older], ["older"], "2026-01-01T00:00:00.000Z")).toEqual([
      "everyone",
    ])
  })

  it("skips articles published before the account was made", () => {
    expect(unreadHelpDocs([everyone, older], [], "2026-10-01T12:00:00.000Z")).toEqual(["everyone"])
  })

  it("counts an article published the day the account was made", () => {
    expect(unreadHelpDocs([everyone], [], "2026-10-18T23:00:00.000Z")).toEqual(["everyone"])
  })
})

describe("readFromPreference", () => {
  it("reads the stored slugs", () => {
    expect(readFromPreference({ read: ["a", "b"] })).toEqual(["a", "b"])
  })

  it("treats a missing or malformed preference as nothing read", () => {
    expect(readFromPreference(undefined)).toEqual([])
    expect(readFromPreference({ read: "a" })).toEqual([])
    expect(readFromPreference({ read: ["a", 1] })).toEqual(["a"])
  })
})
