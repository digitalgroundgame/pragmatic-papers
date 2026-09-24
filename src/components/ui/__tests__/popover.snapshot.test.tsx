import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import { Popover, PopoverContent, PopoverTrigger } from "../popover"

afterEach(cleanup)

describe("Popover", () => {
  it("renders trigger", () => {
    const { container } = render(
      <Popover>
        <PopoverTrigger>Open</PopoverTrigger>
        <PopoverContent>Content</PopoverContent>
      </Popover>,
    )
    expect(container.firstChild).toMatchSnapshot()
  })

  it("trigger is accessible as a button", () => {
    render(
      <Popover>
        <PopoverTrigger>Share</PopoverTrigger>
        <PopoverContent>Content</PopoverContent>
      </Popover>,
    )
    expect(screen.getByRole("button", { name: "Share" })).toBeInTheDocument()
  })
})
