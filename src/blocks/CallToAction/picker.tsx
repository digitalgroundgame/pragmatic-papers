/** @jsxImportSource @/blocks/blockImages/svg */
import { Megaphone } from "lucide"

import { type BlockPicker, BRAND, Button, Card, Heading, Line } from "@/blocks/blockImages/shapes"

const thumbnail = (
  <Card x={60} y={56} w={360} h={208}>
    <Heading x={92} y={88} w={240} h={22} />
    <Line x={92} y={130} w={296} />
    <Line x={92} y={154} w={230} />
    <Button x={92} y={196} w={140} h={40} />
    <path
      d="M252 216 h28 m-10 -10 l10 10 l-10 10"
      stroke={BRAND}
      strokeWidth={5}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  </Card>
)

/** Its images in the block picker. */
export const ctaPicker: BlockPicker = { thumbnail, icon: Megaphone }
