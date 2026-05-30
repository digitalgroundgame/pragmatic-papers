"use client"
import { useFormFields, useRowLabel } from "@payloadcms/ui"

type SlotDescriptionsMap = Record<string, string[]>

interface SlotRowLabelProps {
  slotDescriptions: SlotDescriptionsMap
  parentPath: string
}

export const SlotRowLabel: React.FC<SlotRowLabelProps> = ({ slotDescriptions, parentPath }) => {
  const { rowNumber } = useRowLabel()
  const layout = useFormFields(
    ([fields]) => fields[`${parentPath}.layout`]?.value as string | undefined,
  )

  const descriptions = layout ? slotDescriptions[layout] : undefined
  const label = descriptions?.[rowNumber!] ?? `Slot ${rowNumber}`

  return <>{label}</>
}
