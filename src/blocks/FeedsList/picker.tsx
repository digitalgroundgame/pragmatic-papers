import { Rss } from "lucide-react"

import { type BlockPicker, BRAND, Card, Line, PAPER, TEXT_DARK } from "@/blocks/blockImages/shapes"

const thumbnail = (
  <>
    {[44, 124, 204].map((y) => (
      <Card key={y} x={60} y={y} w={360} h={68}>
        <rect x={76} y={y + 14} width={40} height={40} rx={10} fill={BRAND} />
        <circle cx={88} cy={y + 42} r={3.5} fill={PAPER} />
        <path
          d={`M84 ${y + 31} a11 11 0 0 1 11 11 M84 ${y + 22} a20 20 0 0 1 20 20`}
          stroke={PAPER}
          strokeWidth={4}
          strokeLinecap="round"
          fill="none"
        />
        <Line x={132} y={y + 18} w={150} fill={TEXT_DARK} />
        <Line x={132} y={y + 38} w={250} />
      </Card>
    ))}
  </>
)

/** Its images in the block picker. */
export const feedsListPicker: BlockPicker = { thumbnail, icon: Rss }
