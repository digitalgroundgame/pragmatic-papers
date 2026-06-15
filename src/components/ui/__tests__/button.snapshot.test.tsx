import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { Button } from "../button"

// Snapshot tests for Button variants. To update snapshots after intentional changes:
// pnpm test:unit -- --update-snapshots
describe("Button", () => {
  it("renders default variant", () => {
    const { container } = render(<Button>Click me</Button>)
    expect(container.firstChild).toMatchSnapshot()
  })

  it("renders outline variant", () => {
    const { container } = render(<Button variant="outline">Outline</Button>)
    expect(container.firstChild).toMatchSnapshot()
  })

  it("renders icon size", () => {
    const { container } = render(<Button size="icon" aria-label="icon button" />)
    expect(container.firstChild).toMatchSnapshot()
  })
})
