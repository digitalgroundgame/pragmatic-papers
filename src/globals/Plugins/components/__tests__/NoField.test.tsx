import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { NoField } from "../NoField"

describe("NoField", () => {
  it("renders nothing", () => {
    const { container } = render(<NoField />)
    expect(container).toBeEmptyDOMElement()
  })
})
