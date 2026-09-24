import type { CollectionGridBlock } from "@/payload-types"
import type { ArrayField, ValidateOptions } from "payload"
import { slotCounts } from "../helpers/layouts"

export function validateSlots(
  value: unknown[] | null | undefined,
  { siblingData }: ValidateOptions<unknown, CollectionGridBlock, ArrayField, unknown[]>,
): string | true {
  const layout = siblingData.layout
  if (!layout) return true
  const counts = slotCounts[layout]
  if (!counts) return true
  const [minRows, maxRows] = counts
  const count = value?.length ?? 0
  if (count < minRows) return `This layout requires at least ${minRows} slots (currently ${count}).`
  if (count > maxRows) return `This layout supports at most ${maxRows} slots (currently ${count}).`
  return true
}
