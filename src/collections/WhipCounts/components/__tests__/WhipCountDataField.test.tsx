import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import type { JSONFieldClientProps } from "payload"
import React from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { parseWhipCount, type WhipCountData } from "@/interactives/whip-count/model"
import { whipCountData } from "@/stories/fixtures/whipCount"

import { WhipCountDataField } from "../WhipCountDataField"

let mockValue: unknown
const setValue = vi.fn((next: unknown) => {
  mockValue = next
})

vi.mock("@payloadcms/ui", () => ({
  useField: () => ({ value: mockValue, setValue, showError: false }),
  JSONField: () => <div data-testid="json-editor" />,
}))

const props = {
  path: "data",
  field: { name: "data", label: "Data", admin: { description: "The count." } },
} as unknown as JSONFieldClientProps

const saved = (): WhipCountData => setValue.mock.lastCall![0] as WhipCountData

describe("WhipCountDataField", () => {
  beforeEach(() => {
    mockValue = JSON.parse(JSON.stringify(whipCountData))
    setValue.mockClear()
  })
  afterEach(cleanup)

  it("lists every person with their position", () => {
    render(<WhipCountDataField {...props} />)
    expect(screen.getByLabelText("Name for Marion Hale")).toHaveValue("Marion Hale")
    expect(screen.getByLabelText("Position for Marion Hale")).toHaveValue("backs:hale")
    expect(screen.getByLabelText("Position for Sam Okafor")).toHaveValue("undeclared")
    expect(screen.getByText(/11 people · Marion Hale vs\. Daniel Ortiz/)).toBeInTheDocument()
  })

  it("writes a changed position to the form, as data the page accepts", () => {
    render(<WhipCountDataField {...props} />)
    fireEvent.change(screen.getByLabelText("Position for Sam Okafor"), {
      target: { value: "leans:ortiz" },
    })
    const okafor = saved().members.find((m) => m.name === "Sam Okafor")
    expect(okafor).toMatchObject({ stance: "leans", candidate: "ortiz" })
    expect(parseWhipCount(saved()).success).toBe(true)
  })

  it("clears the candidate when a position names nobody", () => {
    render(<WhipCountDataField {...props} />)
    fireEvent.change(screen.getByLabelText("Position for Marion Hale"), {
      target: { value: "undeclared" },
    })
    const hale = saved().members.find((m) => m.name === "Marion Hale")
    expect(hale?.stance).toBe("undeclared")
    expect(hale?.candidate).toBeUndefined()
  })

  it("keeps what is typed, a trailing space included", () => {
    const { rerender } = render(<WhipCountDataField {...props} />)
    fireEvent.change(screen.getByLabelText("Name for Sam Okafor"), { target: { value: "Sam " } })
    rerender(<WhipCountDataField {...props} />)
    expect(screen.getByLabelText("Name for Sam")).toHaveValue("Sam ")
  })

  it("records a statement, its date and its source", () => {
    render(<WhipCountDataField {...props} />)
    fireEvent.change(screen.getByLabelText("What Sam Okafor said"), {
      target: { value: "“We’ll see who’s running.”" },
    })
    fireEvent.change(screen.getByLabelText("Date Sam Okafor said it"), {
      target: { value: "2026-11-12" },
    })
    fireEvent.change(screen.getByLabelText("Source link for Sam Okafor"), {
      target: { value: "https://www.example.org/okafor" },
    })
    const parsed = parseWhipCount(saved())
    const okafor = parsed.success && parsed.value.members.find((m) => m.name === "Sam Okafor")
    expect(okafor).toMatchObject({
      basis: "“We’ll see who’s running.”",
      basisDate: "2026-11-12",
      source: { url: "https://www.example.org/okafor", label: "example.org" },
    })
  })

  it("adds and removes a person", () => {
    render(<WhipCountDataField {...props} />)
    fireEvent.click(screen.getByRole("button", { name: "Add a person" }))
    expect(saved().members).toHaveLength(12)
    fireEvent.click(screen.getByRole("button", { name: "Remove Walter Finch" }))
    expect(saved().members.some((m) => m.name === "Walter Finch")).toBe(false)
  })

  it("switches to the JSON editor and back", () => {
    render(<WhipCountDataField {...props} />)
    fireEvent.click(screen.getByRole("button", { name: "Edit as JSON" }))
    expect(screen.getByTestId("json-editor")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Edit as a table" }))
    expect(screen.getByLabelText("Name for Marion Hale")).toBeInTheDocument()
  })

  it("shows the JSON editor for a new count, and says why unreadable data has no table", () => {
    mockValue = undefined
    const { unmount } = render(<WhipCountDataField {...props} />)
    expect(screen.getByTestId("json-editor")).toBeInTheDocument()
    unmount()

    mockValue = { schema: "something else" }
    render(<WhipCountDataField {...props} />)
    expect(screen.getByText(/can’t be shown as a table: "schema" must be/)).toBeInTheDocument()
  })
})
