import type * as MediaModule from "@/components/Media"
import type { Media, User } from "@/payload-types"
import { render } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { AuthorCard } from "../AuthorCard"

const mockConvertLexicalToPlaintext = vi.hoisted(() => vi.fn())
vi.mock("@payloadcms/richtext-lexical/plaintext", () => ({
  convertLexicalToPlaintext: mockConvertLexicalToPlaintext,
}))

// Only the renderer is stubbed — AuthorCard uses the real isMedia guard.
vi.mock("@/components/Media", async (importOriginal) => ({
  ...(await importOriginal<typeof MediaModule>()),
  Media: () => <div data-testid="media" />,
}))

vi.mock("@/components/Authors/AuthorLinks", () => ({
  AuthorLinks: () => <div data-testid="author-links" />,
}))

type Author = User

const mockBiography: Author["biography"] = {
  root: {
    type: "root",
    children: [],
    direction: "ltr",
    format: "",
    indent: 0,
    version: 1,
  },
}

const baseAuthor: Author = {
  id: 1,
  name: "Alice Smith",
  slug: "alice-smith",
  email: "alice@example.com",
  updatedAt: "2024-01-01T00:00:00.000Z",
  createdAt: "2024-01-01T00:00:00.000Z",
  collection: "users",
}

describe("AuthorCard", () => {
  it("renders minimal author with no bio, image, or affiliation", () => {
    const { container } = render(<AuthorCard author={baseAuthor} />)
    expect(container.firstChild).toMatchSnapshot()
  })

  it("renders with affiliation and short biography", () => {
    mockConvertLexicalToPlaintext.mockReturnValueOnce("A short bio.")
    const author: Author = {
      ...baseAuthor,
      id: 2,
      name: "Bob Jones",
      slug: "bob-jones",
      affiliation: "MIT",
      biography: mockBiography,
    }
    const { container } = render(<AuthorCard author={author} />)
    expect(container.firstChild).toMatchSnapshot()
  })

  it("renders with biography longer than 255 characters (truncates)", () => {
    mockConvertLexicalToPlaintext.mockReturnValueOnce("x".repeat(300))
    const author: Author = {
      ...baseAuthor,
      id: 3,
      name: "Carol White",
      slug: "carol-white",
      biography: mockBiography,
    }
    const { container } = render(<AuthorCard author={author} />)
    expect(container.firstChild).toMatchSnapshot()
  })

  it("renders with profileImage as a numeric id", () => {
    const author: Author = { ...baseAuthor, profileImage: 42 }
    const { container } = render(<AuthorCard author={author} />)
    expect(container.firstChild).toMatchSnapshot()
  })

  it("renders with profileImage object containing a square URL", () => {
    const author: Author = {
      ...baseAuthor,
      profileImage: {
        id: 99,
        updatedAt: "2024-01-01T00:00:00.000Z",
        createdAt: "2024-01-01T00:00:00.000Z",
        sizes: { square: { url: "https://example.com/alice-square.jpg" } },
      } as Media,
    }
    const { container } = render(<AuthorCard author={author} />)
    expect(container.firstChild).toMatchSnapshot()
  })

  it("renders with profileImage object without a square URL", () => {
    const author: Author = {
      ...baseAuthor,
      profileImage: {
        id: 100,
        updatedAt: "2024-01-01T00:00:00.000Z",
        createdAt: "2024-01-01T00:00:00.000Z",
      } as Media,
    }
    const { container } = render(<AuthorCard author={author} />)
    expect(container.firstChild).toMatchSnapshot()
  })

  it("renders with null name using fallback", () => {
    const author: Author = { ...baseAuthor, name: null }
    const { container } = render(<AuthorCard author={author} />)
    expect(container.firstChild).toMatchSnapshot()
  })
})
