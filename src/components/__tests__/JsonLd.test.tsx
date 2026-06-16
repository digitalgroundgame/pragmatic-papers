import { JsonLd } from "@/components/JsonLd"
import type { Thing } from "schema-dts"
import { describe, expect, it } from "vitest"

function renderJson(data: Thing | Thing[]): Record<string, unknown> {
  const element = JsonLd({ data })
  const props = element.props as { dangerouslySetInnerHTML: { __html: string } }
  return JSON.parse(props.dangerouslySetInnerHTML.__html) as Record<string, unknown>
}

describe("JsonLd", () => {
  it("wraps multiple entities in a single object with a top-level @context and @graph", () => {
    const data: Thing[] = [
      { "@type": "WebSite", name: "A" },
      { "@type": "Organization", name: "B" },
    ]

    const parsed = renderJson(data)

    expect(parsed["@context"]).toBe("https://schema.org")
    expect(Array.isArray(parsed)).toBe(false)

    const graph = parsed["@graph"] as Record<string, unknown>[]
    expect(graph).toHaveLength(2)
    expect(graph[0]?.["@type"]).toBe("WebSite")
  })

  it("collapses a single-element array to a plain object", () => {
    const parsed = renderJson([{ "@type": "WebSite", name: "A" }])

    expect(parsed["@context"]).toBe("https://schema.org")
    expect(parsed["@type"]).toBe("WebSite")
    expect(parsed["@graph"]).toBeUndefined()
  })

  it("emits a single entity as a plain object", () => {
    const parsed = renderJson({ "@type": "WebSite", name: "A" })

    expect(parsed["@context"]).toBe("https://schema.org")
    expect(parsed["@type"]).toBe("WebSite")
    expect(parsed["@graph"]).toBeUndefined()
  })

  it("emits an empty array as an empty graph", () => {
    const parsed = renderJson([])

    expect(parsed["@context"]).toBe("https://schema.org")
    expect(parsed["@graph"]).toEqual([])
  })
})
