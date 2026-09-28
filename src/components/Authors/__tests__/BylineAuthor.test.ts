import type { Media, User } from "@/payload-types"
import { describe, expect, it } from "vitest"

import { toBylineAuthor } from "../BylineAuthor"

const makeUser = (profileImage: User["profileImage"]): User =>
  ({
    id: 1,
    name: "Alice Smith",
    slug: "alice-smith",
    profileImage,
    affiliation: "Somewhere",
    biography: { root: { children: [] } },
    email: "alice@example.com",
    roles: ["writer"],
  }) as unknown as User

describe("toBylineAuthor", () => {
  it("keeps only the fields the byline draws", () => {
    // The point of this type: `Byline` is a client component, so anything left
    // on the object is serialised into the page's RSC payload.
    expect(Object.keys(toBylineAuthor(makeUser(null))).sort()).toEqual([
      "avatarUrl",
      "id",
      "name",
      "slug",
    ])
  })

  it("takes the square thumbnail from a populated profile image", () => {
    const author = toBylineAuthor(
      makeUser({ id: 100, sizes: { square: { url: "/media/alice-square.jpg" } } } as Media),
    )
    expect(author.avatarUrl).toBe("/media/alice-square.jpg")
  })

  it("has no avatar URL when the profile image lacks a square size", () => {
    expect(toBylineAuthor(makeUser({ id: 100, sizes: {} } as Media)).avatarUrl).toBeNull()
  })

  it("has no avatar URL for an unpopulated profile image id", () => {
    expect(toBylineAuthor(makeUser(42)).avatarUrl).toBeNull()
  })

  it("has no avatar URL when there is no profile image at all", () => {
    expect(toBylineAuthor(makeUser(null)).avatarUrl).toBeNull()
  })
})
