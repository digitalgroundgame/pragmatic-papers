import { LayoutGrid } from "lucide-react"

import { type BlockPicker, Card, Line, Picture, TEXT_DARK } from "@/blocks/blockImages/shapes"

const thumbnail = (
  <>
    {[0, 1].flatMap((row) =>
      [0, 1, 2].map((col) => {
        const x = 44 + col * 136
        const y = 36 + row * 128
        return (
          <Card key={`${row}-${col}`} x={x} y={y} w={120} h={116}>
            <Picture id={`grid-${row}-${col}`} x={x + 8} y={y + 8} w={104} h={60} />
            <Line x={x + 10} y={y + 78} w={92} fill={TEXT_DARK} />
            <Line x={x + 10} y={y + 96} w={60} />
          </Card>
        )
      }),
    )}
  </>
)

/** Its images in the block picker. */
export const collectionGridPicker: BlockPicker = { thumbnail, icon: LayoutGrid }
