/** @jsxImportSource @/blocks/blockImages/svg */
import { Tags } from "lucide"

import { type BlockPicker, Card, Line, Picture, TEXT_DARK } from "@/blocks/blockImages/shapes"

const thumbnail = (
  <>
    {[40, 124, 208].map((y) => (
      <Card key={y} x={60} y={y} w={360} h={72}>
        <Picture id={`topic-${y}`} x={76} y={y + 12} w={72} h={48} />
        <Line x={164} y={y + 18} w={140} fill={TEXT_DARK} />
        <Line x={164} y={y + 40} w={220} />
      </Card>
    ))}
  </>
)

/** Its images in the block picker: a column of topic tiles. */
export default { thumbnail, icon: Tags } satisfies BlockPicker
