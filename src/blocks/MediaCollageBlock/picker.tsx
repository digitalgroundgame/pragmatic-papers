import { LayoutDashboard } from "lucide-react"

import { type BlockPicker, Picture } from "@/blocks/blockImages/shapes"

const thumbnail = (
  <>
    <Picture id="collage-1" x={60} y={40} w={216} h={240} />
    <Picture id="collage-2" x={288} y={40} w={132} h={114} />
    <Picture id="collage-3" x={288} y={166} w={132} h={114} />
  </>
)

/** Its images in the block picker. */
export const mediaCollagePicker: BlockPicker = { thumbnail, icon: LayoutDashboard }
