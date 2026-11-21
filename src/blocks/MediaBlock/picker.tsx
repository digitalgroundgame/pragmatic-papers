/** @jsxImportSource @/blocks/blockImages/svg */
import { Image as ImageIcon } from "lucide"

import { type BlockPicker, Line, Picture, TEXT_DARK } from "@/blocks/blockImages/shapes"

const thumbnail = (
  <>
    <Picture id="media" x={60} y={36} w={360} h={208} />
    <Line x={150} y={260} w={180} fill={TEXT_DARK} />
    <Line x={180} y={282} w={120} />
  </>
)

/** Its images in the block picker. */
export default { thumbnail, icon: ImageIcon } satisfies BlockPicker
