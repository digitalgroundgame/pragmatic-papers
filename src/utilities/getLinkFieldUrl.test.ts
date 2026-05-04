import { getLinkFieldUrl } from "./getLinkFieldUrl"

describe("getLinkFieldUrl", () => {
  it("returns null for undefined", () => {
    expect(getLinkFieldUrl(undefined)).toBeNull()
  })

  it("returns direct url for non-reference link", () => {
    const link = { type: "custom", url: "/some-page" } as unknown as Parameters<
      typeof getLinkFieldUrl
    >[0]
    expect(getLinkFieldUrl(link)).toBe("/some-page")
  })

  it("returns / for home slug", () => {
    const link = {
      type: "reference",
      reference: { value: { slug: "home" } },
    } as unknown as Parameters<typeof getLinkFieldUrl>[0]
    expect(getLinkFieldUrl(link)).toBe("/")
  })

  it("returns /pages/slug for pages reference", () => {
    const link = {
      type: "reference",
      reference: { relationTo: "pages", value: { slug: "about" } },
    } as unknown as Parameters<typeof getLinkFieldUrl>[0]
    expect(getLinkFieldUrl(link)).toBe("/about")
  })

  it("returns /articles/slug for articles reference", () => {
    const link = {
      type: "reference",
      reference: { relationTo: "articles", value: { slug: "my-article" } },
    } as unknown as Parameters<typeof getLinkFieldUrl>[0]
    expect(getLinkFieldUrl(link)).toBe("/articles/my-article")
  })

  it("returns null when reference has no slug", () => {
    const link = {
      type: "reference",
      reference: { value: {} },
    } as unknown as Parameters<typeof getLinkFieldUrl>[0]
    expect(getLinkFieldUrl(link)).toBeNull()
  })

  it("returns null when reference value is not an object", () => {
    const link = {
      type: "reference",
      reference: { value: 123 },
    } as unknown as Parameters<typeof getLinkFieldUrl>[0]
    expect(getLinkFieldUrl(link)).toBeNull()
  })
})
