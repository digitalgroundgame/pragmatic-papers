import type { BylineAuthor } from "@/components/Authors/BylineAuthor"
import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { AvatarStack } from "../AvatarStack"

const makeAuthor = (id: number, name: string, avatarUrl?: string | null): BylineAuthor => ({
  id,
  name,
  slug: name.toLowerCase().replace(/\s+/g, "-"),
  avatarUrl: avatarUrl ?? null,
})

describe("AvatarStack", () => {
  it("renders a single author", () => {
    const { container } = render(<AvatarStack authors={[makeAuthor(1, "Alice Smith")]} />)
    expect(container.firstChild).toMatchSnapshot()
  })

  it("renders multiple authors within the visible cap", () => {
    const { container } = render(
      <AvatarStack
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
      <AvatarStack
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
      <AvatarStack
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
    const { container } = render(<AvatarStack authors={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it("renders author with an avatar URL", () => {
    const { container } = render(
      <AvatarStack authors={[makeAuthor(1, "Alice Smith", "https://example.com/alice.jpg")]} />,
    )
    expect(container.firstChild).toMatchSnapshot()
  })

  it("renders author without an avatar URL", () => {
    const { container } = render(<AvatarStack authors={[makeAuthor(1, "Alice Smith", null)]} />)
    expect(container.firstChild).toMatchSnapshot()
  })

  it("renders author with null name using fallback initial", () => {
    const { container } = render(
      <AvatarStack authors={[{ id: 1, name: null, slug: "anon", avatarUrl: null }]} />,
    )
    expect(container.firstChild).toMatchSnapshot()
  })
})
