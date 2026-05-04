import { toKebabCase } from "./toKebabCase"

describe("toKebabCase", () => {
  it("converts single word", () => {
    expect(toKebabCase("hello")).toBe("hello")
  })

  it("converts PascalCase", () => {
    expect(toKebabCase("HelloWorld")).toBe("hello-world")
  })

  it("converts camelCase", () => {
    expect(toKebabCase("helloWorld")).toBe("hello-world")
  })

  it("converts spaces to hyphens", () => {
    expect(toKebabCase("hello world")).toBe("hello-world")
  })

  it("handles multiple spaces", () => {
    expect(toKebabCase("hello   world")).toBe("hello-world")
  })

  it("converts mixed case with spaces", () => {
    expect(toKebabCase("Hello World Test")).toBe("hello-world-test")
  })

  it("returns empty string for empty input", () => {
    expect(toKebabCase("")).toBe("")
  })
})
