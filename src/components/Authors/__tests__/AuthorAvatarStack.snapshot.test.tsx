import type { Media, User } from "@/payload-types"
import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { AuthorAvatarStack } from "../AuthorAvatarStack"

const makeAuthor = (id: number, name: string, profileImage?: number | null): User =>
  ({
    id,
    name,
    slug: name.toLowerCase().replace(/\s+/g, "-"),
    profileImage: profileImage ?? null,
  }) as User

const makeAuthorWithImage = (id: number, name: string, squareUrl?: string): User =>
  ({
    id,
    name,
    slug: name.toLowerCase().replace(/\s+/g, "-"),
    profileImage: {
      id: 100,
      updatedAt: "2024-01-01T00:00:00.000Z",
      createdAt: "2024-01-01T00:00:00.000Z",
      sizes: squareUrl ? { square: { url: squareUrl } } : undefined,
    } as Media,
  }) as User

describe("AuthorAvatarStack", () => {
  it("renders a single author", () => {
    const { container } = render(<AuthorAvatarStack authors={[makeAuthor(1, "Alice Smith")]} />)
    expect(container.firstChild).toMatchSnapshot()
  })

  it("renders multiple authors within the visible cap", () => {
    const { container } = render(
      <AuthorAvatarStack
        authors={[
          makeAuthor(1, "Alice Smith"),
          makeAuthor(2, "Bob Jones"),
          makeAuthor(3, "Carol White"),
        ]}
      />,
    )
    expect(container.firstChild).toMatchSnapshot()
  })

  it("renders two avatars and a +3 when five authors exceed the cap", () => {
    const { container } = render(
      <AuthorAvatarStack
        authors={[
          makeAuthor(1, "Alice Smith"),
          makeAuthor(2, "Bob Jones"),
          makeAuthor(3, "Carol White"),
          makeAuthor(4, "Dave Brown"),
          makeAuthor(5, "Eve Green"),
        ]}
      />,
    )
    expect(container.firstChild).toMatchSnapshot()
  })

  it("renders two avatars and a +2 rather than three avatars and a +1", () => {
    const { container } = render(
      <AuthorAvatarStack
        authors={[
          makeAuthor(1, "Alice Smith"),
          makeAuthor(2, "Bob Jones"),
          makeAuthor(3, "Carol White"),
          makeAuthor(4, "Dave Brown"),
        ]}
      />,
    )
    expect(container.querySelectorAll('[data-slot="avatar"]')).toHaveLength(2)
    expect(container.textContent).toContain("+2")
  })

  it("returns null for empty authors array", () => {
    const { container } = render(<AuthorAvatarStack authors={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it("renders author with profileImage object with URL", () => {
    const { container } = render(
      <AuthorAvatarStack
        authors={[makeAuthorWithImage(1, "Alice Smith", "https://example.com/alice.jpg")]}
      />,
    )
    expect(container.firstChild).toMatchSnapshot()
  })

  it("renders author with profileImage object without URL", () => {
    const { container } = render(
      <AuthorAvatarStack authors={[makeAuthorWithImage(1, "Alice Smith")]} />,
    )
    expect(container.firstChild).toMatchSnapshot()
  })

  it("renders author with numeric profileImage id", () => {
    const { container } = render(<AuthorAvatarStack authors={[makeAuthor(1, "Alice Smith", 42)]} />)
    expect(container.firstChild).toMatchSnapshot()
  })

  it("renders author with null name using fallback initial", () => {
    const { container } = render(
      <AuthorAvatarStack
        authors={[{ id: 1, name: null, slug: "anon", profileImage: null } as User]}
      />,
    )
    expect(container.firstChild).toMatchSnapshot()
  })
})
