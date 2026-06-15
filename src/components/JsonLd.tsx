import type { Graph, Thing, WithContext } from "schema-dts"
import React from "react"

interface JsonLdProps {
  data: WithContext<Thing> | WithContext<Thing>[]
}

export function JsonLd({ data }: JsonLdProps): React.ReactElement {
  // Multiple entities are emitted as a single object with a top-level `@context`
  // and a `@graph` array — the standard JSON-LD shape for multiple things. A bare
  // top-level array carries no top-level `@context`, which crashes consumers that
  // read `parsed["@context"]` directly (e.g. the per-node context lives elsewhere).
  const json: WithContext<Thing> | Graph = Array.isArray(data)
    ? {
        "@context": "https://schema.org",
        "@graph": data.map((node) => {
          const copy = { ...(node as Record<string, unknown>) }
          delete copy["@context"]
          return copy as Thing
        }),
      }
    : data

  return (
    // eslint-disable-next-line react/no-danger
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(json) }} />
  )
}
