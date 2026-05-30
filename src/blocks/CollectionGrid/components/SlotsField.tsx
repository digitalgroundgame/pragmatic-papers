"use client"
import { ArrayField, useFormFields } from "@payloadcms/ui"
import type { ArrayFieldClientProps } from "payload"
import React from "react"

type SlotCountMap = Record<string, number>

type SlotsFieldProps = ArrayFieldClientProps & {
  /** Map of layout key → required slot count, passed via clientProps */
  slotCounts: SlotCountMap
  /** The sibling field name for the layout select (default: "layout") */
  layoutFieldName?: string
}

/**
 * Custom array field component for CollectionGrid slots.
 *
 * Locks minRows and maxRows to the required slot count for the selected
 * layout, preventing users from adding or removing slots manually.
 * Row count synchronisation is handled by LayoutSelectField.
 */
export const SlotsField: React.FC<SlotsFieldProps> = (props) => {
  const { slotCounts, layoutFieldName = "layout", path, field } = props

  const basePath = path?.includes(".") ? path.substring(0, path.lastIndexOf(".")) : ""
  const layoutPath = basePath ? `${basePath}.${layoutFieldName}` : layoutFieldName

  const layoutValue = useFormFields(([fields]) => fields[layoutPath]?.value as string | undefined)
  const targetCount = (layoutValue && slotCounts[layoutValue]) || 0

  return <ArrayField {...props} field={{ ...field, minRows: targetCount, maxRows: targetCount }} />
}
