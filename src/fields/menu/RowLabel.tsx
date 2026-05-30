"use client"

import { useRowLabel } from "@payloadcms/ui"

export const RowLabel = (): React.JSX.Element => {
  const { data } = useRowLabel<{ link?: { label: string } }>()
  return <>{data?.link?.label || "Untitled"}</>
}
