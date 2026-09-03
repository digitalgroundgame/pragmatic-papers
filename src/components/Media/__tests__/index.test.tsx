import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { Media } from "../index"
import type { Media as MediaType } from "@/payload-types"

// Each renderer is stubbed so these assert the dispatch, not the rendering.
vi.mock("../ImageMedia", () => ({ ImageMedia: () => <div data-testid="image-media" /> }))
vi.mock("../VideoMedia", () => ({ VideoMedia: () => <div data-testid="video-media" /> }))
vi.mock("../AudioMedia", () => ({ AudioMedia: () => <div data-testid="audio-media" /> }))

afterEach(cleanup)

const file = (mimeType: string): MediaType =>
  ({
    id: 1,
    filename: `file.${mimeType.split("/")[1]}`,
    mimeType,
    url: "/media/file",
    updatedAt: "2024-01-01T00:00:00.000Z",
    createdAt: "2024-01-01T00:00:00.000Z",
  }) as MediaType

describe("Media", () => {
  it.each([
    ["image/jpeg", "image-media"],
    ["video/mp4", "video-media"],
    ["audio/mpeg", "audio-media"],
  ])("routes %s to the matching renderer", (mimeType, testId) => {
    render(<Media media={file(mimeType)} />)
    expect(screen.getByTestId(testId)).toBeInTheDocument()
  })

  it("renders nothing for an unresolved relation", () => {
    // Depth-0 queries return the id, which carries no mime type to dispatch on.
    const { container } = render(<Media media={10} />)
    expect(container).toBeEmptyDOMElement()
  })

  it.each([
    ["null", null],
    ["undefined", undefined],
  ])("renders nothing when the media is %s", (_label, media) => {
    const { container } = render(<Media media={media} />)
    expect(container).toBeEmptyDOMElement()
  })

  it("renders nothing for a file with no mime type", () => {
    const { container } = render(<Media media={{ ...file("image/jpeg"), mimeType: null }} />)
    expect(container).toBeEmptyDOMElement()
  })
})
