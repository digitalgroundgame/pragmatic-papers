import { BernoulliLeft } from "../layouts/BernoulliLeft"
import { BernoulliRight } from "../layouts/BernoulliRight"
import { Euler2 } from "../layouts/Euler2"
import { Euler3 } from "../layouts/Euler3"
import { Euler5 } from "../layouts/Euler5"
import { Fibonacci6 } from "../layouts/Fibonacci6"
import { Fibonacci7 } from "../layouts/Fibonacci7"
import { Gauss10 } from "../layouts/Gauss10"
import { Newton4 } from "../layouts/Newton4"
import { Vespucci7 } from "../layouts/Vespucci7"
import type { LayoutDefinition } from "../types"

export type Layout =
  | "bernoulli-left"
  | "bernoulli-right"
  | "euler-2"
  | "euler-3"
  | "newton-4"
  | "euler-5"
  | "fibonacci-6"
  | "fibonacci-7"
  | "vespucci-7"
  | "gauss-10"

export const layouts = {
  "bernoulli-left": BernoulliLeft,
  "bernoulli-right": BernoulliRight,
  "euler-2": Euler2,
  "euler-3": Euler3,
  "newton-4": Newton4,
  "euler-5": Euler5,
  "fibonacci-6": Fibonacci6,
  "vespucci-7": Vespucci7,
  "fibonacci-7": Fibonacci7,
  "gauss-10": Gauss10,
} as const satisfies Record<Layout, LayoutDefinition>

export const slotCounts: Record<string, [number, number]> = Object.fromEntries(
  Object.entries(layouts).map(([key, { slotDescriptions, minSlots, maxSlots }]) => [
    key,
    [minSlots ?? slotDescriptions.length, maxSlots ?? slotDescriptions.length],
  ]),
)

export const slotDescriptions: Record<string, string[]> = Object.fromEntries(
  Object.entries(layouts).map(([key, def]) => [key, def.slotDescriptions]),
)
