"use client"

import { useState } from "react"

import { LoadOnInteraction } from "@/components/LoadOnInteraction"

import { LinkIcon } from "./LinkIcon"

// The tooltip (base-ui's Tooltip and floating-ui) loads when the reader reaches for a link,
// so the ticker adds no JavaScript to the page until then.
const load = () => import("./LinkTooltip").then((m) => m.LinkTooltip)

/** `LinkTooltip`, as its plain icon link until the reader points at, focuses or clicks it. */
export function LazyLinkTooltip({ url }: { url: string }): React.ReactNode {
  // The pointer that loads the tooltip is already on the icon when it arrives, and a pointer
  // that doesn't move raises no new event, so the tooltip is told to open for it.
  const [pointed, setPointed] = useState(false)
  return (
    <span
      className="contents"
      onPointerOver={() => setPointed(true)}
      onPointerOut={() => setPointed(false)}
    >
      <LoadOnInteraction load={load} props={{ url, pointed }}>
        <LinkIcon url={url} />
      </LoadOnInteraction>
    </span>
  )
}
