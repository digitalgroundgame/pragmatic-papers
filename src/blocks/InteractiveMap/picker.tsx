/** @jsxImportSource @/blocks/blockImages/svg */
import { Map as MapIcon } from "lucide"

import {
  type BlockPicker,
  BRAND,
  BRAND_MID,
  BRAND_SOFT,
  BRAND_WASH,
  Card,
  INK,
  Line,
} from "@/blocks/blockImages/shapes"

/** Rows of the tile map, by shade: 0 is no region, 1–5 run from light to the brand color. */
const MAP_TILES = [
  [0, 2, 3, 0, 0, 4, 0],
  [1, 3, 5, 4, 2, 5, 3],
  [2, 4, 1, 2, 5, 3, 0],
  [0, 1, 3, 5, 4, 0, 0],
]
const MAP_SHADES = ["", "#f3e5e0", BRAND_WASH, BRAND_SOFT, BRAND_MID, BRAND]

const thumbnail = (
  <>
    {MAP_TILES.flatMap((row, r) =>
      row.map((shade, c) =>
        shade === 0 ? null : (
          <rect
            key={`${r}-${c}`}
            x={74 + c * 48}
            y={36 + r * 48}
            width={42}
            height={42}
            rx={10}
            fill={MAP_SHADES[shade]}
          />
        ),
      ),
    )}
    {[1, 2, 3, 4, 5].map((shade, i) => (
      <rect
        key={shade}
        x={140 + i * 42}
        y={244}
        width={38}
        height={14}
        rx={4}
        fill={MAP_SHADES[shade]}
      />
    ))}
    <Line x={140} y={270} w={40} />
    <Line x={306} y={270} w={40} />
    <Card x={300} y={150} w={120} h={56}>
      <Line x={314} y={164} w={70} fill={INK} />
      <Line x={314} y={184} w={92} fill={BRAND} />
    </Card>
  </>
)

/** Its images in the block picker. */
export const interactiveMapPicker: BlockPicker = { thumbnail, icon: MapIcon }
