import { cleanup, render, screen } from "@testing-library/react"
import React from "react"
import { afterEach, describe, expect, it } from "vitest"

import { PaginationVolumes } from "@/components/PaginationVolumes"
import { Pagination } from "../index"

afterEach(() => {
  cleanup()
})

describe.each([
  ["Pagination", Pagination],
  ["PaginationVolumes", PaginationVolumes],
])("%s", (_, Component) => {
  it("renders nothing for a single page of results", () => {
    const { container } = render(<Component page={1} totalPages={1} />)
    expect(container).toBeEmptyDOMElement()
  })

  it("renders nothing when Payload reports no page", () => {
    const { container } = render(<Component page={undefined} totalPages={0} />)
    expect(container).toBeEmptyDOMElement()
  })

  it("renders page links when there is more than one page", () => {
    render(<Component page={1} totalPages={3} />)
    expect(screen.getByRole("navigation")).toBeInTheDocument()
  })
})
