import type { Media } from "@/payload-types"

const TIMESTAMP = "2026-01-15T12:00:00.000Z"

let nextId = 1000

function image(file: string, width: number, height: number, alt: string): Media {
  const url = `/storybook-assets/${file}`
  const size = { url, width, height, mimeType: "image/svg+xml" }
  return {
    id: nextId++,
    alt,
    url,
    filename: file,
    mimeType: "image/svg+xml",
    width,
    height,
    sizes: {
      thumbnail: size,
      square: size,
      small: size,
      medium: size,
      large: size,
      xlarge: size,
    },
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
  }
}

export const landscapeImage = image("landscape.svg", 1600, 900, "Mountains at sunset")
export const portraitImage = image("portrait.svg", 800, 1200, "A printed page on a green desk")
export const squareImage = image("square.svg", 800, 800, "Portrait of a writer")
export const wideImage = image("wide.svg", 1920, 400, "A city skyline at dusk")

export function mediaFixture(overrides: Partial<Media> = {}): Media {
  return { ...landscapeImage, id: nextId++, ...overrides }
}

export const narrationAudio: Media = {
  id: nextId++,
  alt: "Article narration",
  url: "/storybook-assets/narration.wav",
  filename: "narration.wav",
  mimeType: "audio/wav",
  duration: 3,
  createdAt: TIMESTAMP,
  updatedAt: TIMESTAMP,
}
