import { render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { UnsplashControl } from "../index"

vi.mock("../UnsplashPicker", () => ({
  UnsplashPicker: () => <button type="button">Search Unsplash</button>,
}))

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("UnsplashControl", () => {
  it("offers the picker when the access key is set", () => {
    vi.stubEnv("UNSPLASH_ACCESS_KEY", "key")
    const { getByRole } = render(<>{UnsplashControl()}</>)
    expect(getByRole("button", { name: "Search Unsplash" })).toBeInTheDocument()
  })

  it("renders nothing without the key", () => {
    vi.stubEnv("UNSPLASH_ACCESS_KEY", "")
    const { container } = render(<>{UnsplashControl()}</>)
    expect(container).toBeEmptyDOMElement()
  })
})
