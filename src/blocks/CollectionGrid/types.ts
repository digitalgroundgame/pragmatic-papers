import type { CollectionGridSlots } from "@/payload-types"

export interface LayoutDefinition {
  /** Human-readable name shown in the layout selector */
  label: string
  /** One description string per slot, in order. Length determines slot count. */
  slotDescriptions: string[]
  /** Minimum required slots for this layout */
  minSlotCount?: number
}

export interface LayoutProps extends React.ComponentProps<"section"> {
  slots: CollectionGridSlots
  priority?: boolean
  loading?: "eager" | "lazy"
}
