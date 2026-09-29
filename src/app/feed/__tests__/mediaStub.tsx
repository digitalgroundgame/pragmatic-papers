import type { Media } from "@/payload-types"
import React from "react"

// `@/components/Media` renders next/image, which needs the Next runtime.
// Tests swap it for a plain <img> via `vi.mock("@/components/Media", ...)`.
export const mediaStub = {
  isMedia: (media: unknown): boolean => Boolean(media) && typeof media !== "number",
  Media: ({ media }: { media: Media }): React.JSX.Element => (
    // eslint-disable-next-line @next/next/no-img-element -- test stub, not real markup
    <img alt={media.alt ?? ""} data-testid="media" />
  ),
}
