import type { Graph, Thing, WithContext } from "schema-dts"
import React from "react"

interface JsonLdProps {
  data: Thing | Thing[]
}

export function JsonLd({ data }: JsonLdProps): React.ReactElement {
  const nodes = Array.isArray(data) ? data : [data]
  const json: WithContext<Thing> | Graph =
    nodes.length === 1
      ? ({ "@context": "https://schema.org", ...(nodes[0] as object) } as WithContext<Thing>)
      : { "@context": "https://schema.org", "@graph": nodes }

  return (
    // eslint-disable-next-line react/no-danger
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(json) }} />
  )
}
