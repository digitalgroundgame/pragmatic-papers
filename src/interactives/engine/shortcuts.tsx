import React from "react"

import { Kbd, KbdGroup } from "@/components/ui/kbd"
import type { Data } from "@/blocks/InteractiveMap/Info"

/**
 * The map's keyboard and pointer shortcuts, described in one place so the footer and the
 * handler that wires them (`DrilldownMapClient`'s `onKeyDown`, `stage.ts`'s wheel listener)
 * cannot drift apart. Live only while the map has focus, and never inside a text field — see
 * the handler for the exact gate.
 */
export const MAP_SHORTCUTS: Data[] = [
  {
    label: "Zoom",
    value: (
      <KbdGroup>
        <Kbd>Scroll</Kbd>
        <Kbd>+</Kbd>
        <Kbd>−</Kbd>
      </KbdGroup>
    ),
  },
  { label: "Fit the whole map", value: <Kbd>0</Kbd> },
  {
    label: "Pan",
    value: (
      <KbdGroup>
        <Kbd>↑</Kbd>
        <Kbd>↓</Kbd>
        <Kbd>←</Kbd>
        <Kbd>→</Kbd>
      </KbdGroup>
    ),
  },
  { label: "Full screen", value: <Kbd>F</Kbd> },
  { label: "Back", value: <Kbd>Esc</Kbd> },
]
