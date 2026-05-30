import type React from "react"

import { Separator } from "@/components/ui/separator"
import type {
  CollectionGridBlock as CollectionGridBlockType,
  CollectionGridLayout,
} from "@/payload-types"
import { BernoulliLeftLayout } from "./layouts/BernoulliLeft"
import { BernoulliRightLayout } from "./layouts/BernoulliRight"
import { Euler2Layout } from "./layouts/Euler2"
import { Euler3Layout } from "./layouts/Euler3"
import { Euler5Layout } from "./layouts/Euler5"
import { Fibonacci6Layout } from "./layouts/Fibonacci6"
import { Fibonacci7Layout } from "./layouts/Fibonacci7"
import { Newton4Layout } from "./layouts/Newton4"
import { Vespucci7Layout } from "./layouts/Vespucci7"
import type { LayoutProps } from "./types"

const layouts = {
  "bernoulli-left": BernoulliLeftLayout,
  "bernoulli-right": BernoulliRightLayout,
  "euler-2": Euler2Layout,
  "euler-3": Euler3Layout,
  "newton-4": Newton4Layout,
  "euler-5": Euler5Layout,
  "fibonacci-6": Fibonacci6Layout,
  "vespucci-7": Vespucci7Layout,
  "fibonacci-7": Fibonacci7Layout,
} as const satisfies Record<NonNullable<CollectionGridLayout>, React.FC<LayoutProps>>

export const CollectionGridBlock: React.FC<
  CollectionGridBlockType & { priority?: boolean }
> = async (props) => {
  const { layout, id, slots, priority } = props
  if (!layout) return null
  const LayoutComponent = layouts[layout]
  return (
    <>
      <LayoutComponent
        id={id ?? undefined}
        className="container mb-9 items-stretch md:mb-12"
        slots={slots}
        priority={priority}
        loading={priority ? "eager" : undefined}
      />
      <div className="container mb-9 md:mb-12">
        <Separator />
      </div>
    </>
  )
}
