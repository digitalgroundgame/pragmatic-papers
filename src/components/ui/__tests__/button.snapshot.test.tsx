import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { Button } from "../button"

// Snapshot tests for Button variants. To update snapshots after intentional changes:
// pnpm test:unit -u
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

  it("sizes the icon in a large icon button", () => {
    // icon-lg sizes its icon (20px), so callers pass a bare icon.
    const { getByRole } = render(
      <Button size="icon-lg" aria-label="Share">
        <svg aria-hidden="true" />
      </Button>,
    )
    expect(getByRole("button", { name: "Share" })).toHaveClass(
      "size-9",
      "[&_svg:not([class*='size-'])]:size-5",
    )
  })
})
