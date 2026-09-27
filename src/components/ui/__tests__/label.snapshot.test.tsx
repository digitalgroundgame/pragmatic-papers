import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { Label } from "../label"

describe("Label", () => {
  it("renders with text content", () => {
    const { container } = render(<Label>Email address</Label>)
    expect(container.firstChild).toMatchSnapshot()
  })

  it("renders with htmlFor", () => {
    const { container } = render(<Label htmlFor="email-input">Email address</Label>)
    expect(container.firstChild).toMatchSnapshot()
  })

  it("renders with custom className", () => {
    const { container } = render(<Label className="sr-only">Hidden label</Label>)
    expect(container.firstChild).toMatchSnapshot()
  })
})
