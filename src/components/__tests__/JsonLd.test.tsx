import { JsonLd } from "@/components/JsonLd"
import type { Thing, WithContext } from "schema-dts"
import { describe, expect, it } from "vitest"

function renderJson(data: WithContext<Thing> | WithContext<Thing>[]): Record<string, unknown> {
  const element = JsonLd({ data })
  const props = element.props as { dangerouslySetInnerHTML: { __html: string } }
  return JSON.parse(props.dangerouslySetInnerHTML.__html) as Record<string, unknown>
}

describe("JsonLd", () => {
  it("wraps multiple entities in a single object with a top-level @context and @graph", () => {
    const data: WithContext<Thing>[] = [
      { "@context": "https://schema.org", "@type": "WebSite", name: "A" },
      { "@context": "https://schema.org", "@type": "Organization", name: "B" },
    ]

    const parsed = renderJson(data)

    // Consumers that read parsed["@context"] directly must find it at the top level,
    // not be handed a bare array (which has no "@context" and crashes them).
    expect(parsed["@context"]).toBe("https://schema.org")
    expect(Array.isArray(parsed)).toBe(false)

    const graph = parsed["@graph"] as Record<string, unknown>[]
    expect(graph).toHaveLength(2)
    expect(graph[0]?.["@type"]).toBe("WebSite")
    // The redundant per-node @context is dropped now that it lives at the top level.
    expect(graph[0]?.["@context"]).toBeUndefined()
  })

  it("emits a single entity unchanged", () => {
    const data: WithContext<Thing> = {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "A",
    }

    const parsed = renderJson(data)

    expect(parsed["@context"]).toBe("https://schema.org")
    expect(parsed["@type"]).toBe("WebSite")
    expect(parsed["@graph"]).toBeUndefined()
  })
})
