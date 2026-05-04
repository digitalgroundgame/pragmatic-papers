import { formatAuthors } from "./formatAuthors"

const makeAuthor = (name: string, index: number = 0) => ({
  id: `author-${index}`,
  name,
  slug: `author-${index}`,
})

describe("formatAuthors", () => {
  it("returns empty string for empty array", () => {
    expect(formatAuthors([])).toBe("")
  })

  it("returns the name for a single author", () => {
    expect(formatAuthors([makeAuthor("Alice")])).toBe("Alice")
  })

  it('joins two authors with "and"', () => {
    expect(formatAuthors([makeAuthor("Alice"), makeAuthor("Bob")])).toBe("Alice and Bob")
  })

  it('joins three authors with "and" (no oxford comma)', () => {
    expect(formatAuthors([makeAuthor("Alice"), makeAuthor("Bob"), makeAuthor("Charlie")])).toBe(
      "Alice, Bob and Charlie",
    )
  })

  it("filters out authors without a name", () => {
    expect(
      formatAuthors([
        makeAuthor("Alice"),
        { id: "empty", name: "", slug: "empty" },
        makeAuthor("Bob"),
      ]),
    ).toBe("Alice and Bob")
  })

  it("handles four or more authors", () => {
    expect(
      formatAuthors([
        makeAuthor("Alice"),
        makeAuthor("Bob"),
        makeAuthor("Charlie"),
        makeAuthor("Diana"),
      ]),
    ).toBe("Alice, Bob, Charlie and Diana")
  })
})
