// @vitest-environment node
import type { Field, TextField } from "payload"
import { describe, expect, it, vi } from "vitest"

// Swap each feature for a tagged marker so the editor's configuration can be read back
// without booting Payload, which `lexicalEditor` needs to sanitize its features.
vi.mock("@payloadcms/richtext-lexical", () => {
  const feature = (key: string) => (props?: unknown) => ({ key, props })
  return {
    lexicalEditor: (props: unknown) => ({ editorProps: props }),
    BoldFeature: feature("bold"),
    ItalicFeature: feature("italic"),
    LinkFeature: feature("link"),
    ParagraphFeature: feature("paragraph"),
    UnderlineFeature: feature("underline"),
  }
})

const { defaultLexical } = await import("../defaultLexical")

interface Feature {
  key: string
  props?: {
    enabledCollections: string[]
    fields: (args: { defaultFields: Field[] }) => Field[]
  }
}

const { features } = (defaultLexical as unknown as { editorProps: { features: Feature[] } })
  .editorProps

const linkFeature = features.find((f) => f.key === "link")!

const linkFields = () =>
  linkFeature.props!.fields({
    defaultFields: [
      { name: "text", type: "text" },
      { name: "linkType", type: "radio", options: ["custom", "internal"] },
      { name: "url", type: "text", label: "Original URL" },
      { type: "row", fields: [] },
    ],
  })

const urlField = () => linkFields().find((f) => "name" in f && f.name === "url") as TextField

describe("defaultLexical", () => {
  it("enables only paragraph, underline, bold, italic and link", () => {
    expect(features.map((f) => f.key)).toEqual(["paragraph", "underline", "bold", "italic", "link"])
  })

  it("links internally to pages, volumes and articles", () => {
    expect(linkFeature.props?.enabledCollections).toEqual(["pages", "volumes", "articles"])
  })

  it("replaces the default url field and keeps the rest", () => {
    const fields = linkFields()

    expect(fields.map((f) => ("name" in f ? f.name : f.type))).toEqual([
      "text",
      "linkType",
      "row",
      "url",
    ])
    expect(urlField()).toMatchObject({ type: "text", required: true })
    expect(urlField().label).toEqual(expect.any(Function))
  })

  it("hides the url field for internal links", () => {
    const condition = urlField().admin!.condition!

    expect(condition({}, { linkType: "internal" }, {} as never)).toBe(false)
    expect(condition({}, { linkType: "custom" }, {} as never)).toBe(true)
  })

  it("requires a url only for custom links", () => {
    const validate = urlField().validate as (value: unknown, options: unknown) => unknown

    expect(validate("", { siblingData: { linkType: "internal" } })).toBe(true)
    expect(validate("", { siblingData: { linkType: "custom" } })).toBe("URL is required")
    expect(validate(undefined, {})).toBe("URL is required")
    expect(validate("https://example.com", { siblingData: { linkType: "custom" } })).toBe(true)
  })
})
