import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { VideoMedia } from "../VideoMedia"
import type { VideoMediaType } from "../types"

afterEach(() => {
  cleanup()
  vi.unstubAllEnvs()
})

const video = (url: string | null): VideoMediaType => ({
  id: 1,
  filename: "clip.mp4",
  mimeType: "video/mp4",
  url,
  alt: "",
  updatedAt: "2024-01-01T00:00:00.000Z",
  createdAt: "2024-01-01T00:00:00.000Z",
})

describe("VideoMedia", () => {
  // Production used to build the src from NEXT_PUBLIC_SUPABASE_URL and S3_BUCKET,
  // neither of which a client component sees, giving undefined/storage/.../undefined/clip.mp4.
  it.each(["development", "production"])("plays the file's own url in %s", (env) => {
    vi.stubEnv("NODE_ENV", env)
    const { container } = render(<VideoMedia media={video("/media/clip.mp4")} />)
    expect(container.querySelector("video source")).toHaveAttribute("src", "/media/clip.mp4")
  })

  it("keeps a bucket url as the storage plugin resolved it", () => {
    const url = "https://storage.example.com/storage/v1/object/public/media/clip.mp4"
    const { container } = render(<VideoMedia media={video(url)} />)
    expect(container.querySelector("video source")).toHaveAttribute(
      "src",
      `${url}?2024-01-01T00:00:00.000Z`,
    )
  })

  // A declared type the browser can't vouch for makes it skip the source unfetched.
  it("leaves the type for the browser to sniff", () => {
    const { container } = render(
      <VideoMedia media={{ ...video("/media/clip.mov"), mimeType: "video/quicktime" }} />,
    )
    expect(container.querySelector("video source")).not.toHaveAttribute("type")
  })

  it("renders nothing without a url", () => {
    const { container } = render(<VideoMedia media={video(null)} />)
    expect(container).toBeEmptyDOMElement()
  })
})
