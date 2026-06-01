import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { AuthorAvatarStack } from "../AuthorAvatarStack"

const makeAuthor = (id: number, name: string, profileImage?: number | null) => ({
  id,
  name,
  slug: name.toLowerCase().replace(/\s+/g, "-"),
  profileImage: profileImage ?? null,
})

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

  it("renders overflow count when authors exceed cap", () => {
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

  it("returns null for empty authors array", () => {
    const { container } = render(<AuthorAvatarStack authors={[]} />)
    expect(container.firstChild).toBeNull()
  })
})
