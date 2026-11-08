import { Mail } from "lucide-react"

import {
  type BlockPicker,
  BRAND,
  Button,
  Card,
  Heading,
  Input,
  Line,
  PAPER,
} from "@/blocks/blockImages/shapes"

const thumbnail = (
  <Card x={60} y={60} w={360} h={200}>
    <rect x={88} y={88} width={60} height={44} rx={8} fill={BRAND} />
    <path
      d="M94 96 L118 114 L142 96"
      stroke={PAPER}
      strokeWidth={4}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
    <Heading x={168} y={92} w={200} />
    <Line x={168} y={120} w={150} />
    <Input x={88} y={176} w={204} h={44} />
    <Line x={104} y={192} w={100} />
    <Button x={304} y={176} w={88} h={44} />
  </Card>
)

/** Its images in the block picker. */
export const newsletterSignupPicker: BlockPicker = { thumbnail, icon: Mail }
