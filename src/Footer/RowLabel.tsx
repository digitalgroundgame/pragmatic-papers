"use client"
import type { Footer } from "@/payload-types"
import { type RowLabelProps, useRowLabel } from "@payloadcms/ui"

export const RowLabel: React.FC<RowLabelProps> = () => {
  const { data, rowNumber } = useRowLabel<NonNullable<Footer["navItems"]>[number]>()

  let label = "Row"
  if (data?.link?.label) {
    label = `Nav item`
    if (rowNumber !== undefined) {
      label += ` ${rowNumber + 1}`
    }
    label += `: ${data.link.label}`
  }

  return <div>{label}</div>
}
