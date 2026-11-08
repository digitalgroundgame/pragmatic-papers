import { ClipboardList } from "lucide-react"

import { type BlockPicker, Button, Card, Input, Line, TEXT_DARK } from "@/blocks/blockImages/shapes"

const thumbnail = (
  <Card x={80} y={36} w={320} h={248}>
    <Line x={108} y={62} w={80} fill={TEXT_DARK} />
    <Input x={108} y={82} w={264} />
    <Line x={108} y={136} w={110} fill={TEXT_DARK} />
    <Input x={108} y={156} w={264} />
    <Button x={108} y={220} w={124} h={40} />
  </Card>
)

/** Its images in the block picker. */
export const formPicker: BlockPicker = { thumbnail, icon: ClipboardList }
