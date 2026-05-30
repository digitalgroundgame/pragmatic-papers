import type { Thing, WithContext } from "schema-dts"
import React from "react"

interface JsonLdProps {
  data: WithContext<Thing> | WithContext<Thing>[]
}

export function JsonLd({ data }: JsonLdProps): React.ReactElement {
  return (
    // eslint-disable-next-line react/no-danger
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />
  )
}
