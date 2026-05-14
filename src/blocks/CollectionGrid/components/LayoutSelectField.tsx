"use client"
import { SelectField, useForm, useFormFields } from "@payloadcms/ui"
import type { SelectFieldClientProps } from "payload"
import React, { useEffect, useRef } from "react"

type SlotCountMap = Record<string, number>

type LayoutSelectFieldProps = SelectFieldClientProps & {
  /** Map of layout key → required slot count, passed via clientProps */
  slotCounts: SlotCountMap
  /** The sibling field name for the slots array (default: "slots") */
  slotsFieldName?: string
}

/**
 * Custom select field component for the CollectionGrid layout picker.
 *
 * When the user changes the layout, automatically adjusts the number of
 * rows in the sibling slots array to match the required slot count for
 * the selected layout.
 */
export const LayoutSelectField: React.FC<LayoutSelectFieldProps> = (props) => {
  const { slotCounts, slotsFieldName = "slots", path, schemaPath } = props

  // Derive the sibling slots field paths from the layout field's own paths
  const lastDot = path?.lastIndexOf(".")
  const slotsPath =
    lastDot !== undefined && lastDot >= 0
      ? `${path!.substring(0, lastDot)}.${slotsFieldName}`
      : slotsFieldName

  const lastDotSchema = schemaPath?.lastIndexOf(".")
  const slotsSchemaPath =
    lastDotSchema !== undefined && lastDotSchema >= 0
      ? `${schemaPath!.substring(0, lastDotSchema)}.${slotsFieldName}`
      : slotsPath

  const { addFieldRow, removeFieldRow } = useForm()

  const layoutValue = useFormFields(([fields]) => fields[path!]?.value as string | undefined)

  // Keep a ref to the current slot row count so the effect below doesn't
  // need to subscribe to it (avoiding re-runs every time a row is added).
  const rowCount = useFormFields(([fields]) => {
    const slotsField = fields[slotsPath]
    return slotsField && "rows" in slotsField && Array.isArray(slotsField.rows)
      ? slotsField.rows.length
      : 0
  })
  const rowCountRef = useRef(rowCount)
  useEffect(() => {
    rowCountRef.current = rowCount
  })

  const prevLayoutRef = useRef(layoutValue)

  useEffect(() => {
    if (!layoutValue || layoutValue === prevLayoutRef.current) return
    prevLayoutRef.current = layoutValue

    const requiredCount = slotCounts[layoutValue] || 0
    if (!requiredCount) return

    const count = rowCountRef.current
    if (count < requiredCount) {
      for (let i = count; i < requiredCount; i++) {
        addFieldRow({ path: slotsPath, rowIndex: i, schemaPath: slotsSchemaPath })
      }
    } else if (count > requiredCount) {
      for (let i = count - 1; i >= requiredCount; i--) {
        removeFieldRow({ path: slotsPath, rowIndex: i })
      }
    }
  }, [layoutValue, slotCounts, slotsPath, slotsSchemaPath, addFieldRow, removeFieldRow])

  return <SelectField {...props} />
}
