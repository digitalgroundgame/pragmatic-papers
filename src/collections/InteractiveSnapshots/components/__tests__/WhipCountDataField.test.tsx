import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import type { JSONFieldClientProps } from "payload"
import React from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { parseWhipCount, type WhipCountData } from "@/interactives/whip-count/model"
import { whipCountData } from "@/stories/fixtures/whipCount"

import { WhipCountDataField } from "../WhipCountDataField"

let mockValue: unknown
let mockError: string | undefined
const setValue = vi.fn((next: unknown) => {
  mockValue = next
})

vi.mock("@payloadcms/ui", () => ({
  useField: () => ({ value: mockValue, setValue, showError: !!mockError, errorMessage: mockError }),
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
    mockError = undefined
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

  it("shows nothing for a map's feed, which no editor reads", () => {
    mockValue = { schema: "pragmatic-papers/drilldown-data@1", regions: [], records: [] }
    const { container } = render(<WhipCountDataField {...props} />)
    expect(container).toBeEmptyDOMElement()
  })

  it("stays once shown, and says why data pasted mid-edit has no table", () => {
    const { rerender } = render(<WhipCountDataField {...props} />)
    mockValue = { schema: "something else" }
    rerender(<WhipCountDataField {...props} />)
    expect(screen.getByText(/can’t be shown as a table: "schema" must be/)).toBeInTheDocument()
  })

  it("changes a seat, a bloc, tags, a note and the count's dates", () => {
    render(<WhipCountDataField {...props} />)
    fireEvent.change(screen.getByLabelText("Seat for Sam Okafor"), {
      target: { value: "outgoing" },
    })
    fireEvent.change(screen.getByLabelText("Bloc for Sam Okafor"), { target: { value: "" } })
    fireEvent.change(screen.getByLabelText("Tags, separated by commas for Sam Okafor"), {
      target: { value: "Persuadable, Freshman" },
    })
    fireEvent.change(screen.getByLabelText("Note for Sam Okafor"), { target: { value: "A note." } })
    fireEvent.change(screen.getByLabelText("State for Sam Okafor"), { target: { value: "MD" } })
    fireEvent.change(screen.getByLabelText("Party for Sam Okafor"), { target: { value: "I" } })
    fireEvent.change(screen.getByLabelText("Date the count was checked"), {
      target: { value: "2026-11-20" },
    })
    fireEvent.change(screen.getByLabelText("Time of the vote"), {
      target: { value: "2026-12-01T09:30:00-05:00" },
    })
    const parsed = parseWhipCount(saved())
    expect(parsed.success).toBe(true)
    if (!parsed.success) return
    expect(parsed.value).toMatchObject({ asOf: "2026-11-20", voteAt: "2026-12-01T09:30:00-05:00" })
    const okafor = parsed.value.members.find((m) => m.name === "Sam Okafor")!
    expect(okafor).toMatchObject({
      seat: "outgoing",
      state: "MD",
      party: "I",
      tags: ["Persuadable", "Freshman"],
      note: "A note.",
    })
    expect(okafor.bloc).toBeUndefined()
  })

  it("clears a statement, its date, its source, tags and the vote time when emptied", () => {
    render(<WhipCountDataField {...props} />)
    fireEvent.change(screen.getByLabelText("What Marion Hale said"), { target: { value: "" } })
    fireEvent.change(screen.getByLabelText("Date Marion Hale said it"), { target: { value: "" } })
    fireEvent.change(screen.getByLabelText("Source link for Marion Hale"), {
      target: { value: "" },
    })
    fireEvent.change(screen.getByLabelText("Tags, separated by commas for Daniel Ortiz"), {
      target: { value: "" },
    })
    fireEvent.change(screen.getByLabelText("Time of the vote"), { target: { value: "x" } })
    fireEvent.change(screen.getByLabelText("Time of the vote"), { target: { value: "" } })
    const hale = saved().members.find((m) => m.name === "Marion Hale")!
    expect(hale.basis).toBeUndefined()
    expect(hale.basisDate).toBeUndefined()
    expect(hale.source).toBeUndefined()
    expect(saved().members.find((m) => m.name === "Daniel Ortiz")?.tags).toBeUndefined()
    expect(saved().voteAt).toBeUndefined()
  })

  it("shows the form's error, and takes no edits when read-only", () => {
    mockError = "Something is wrong with the data."
    render(<WhipCountDataField {...props} readOnly />)
    expect(screen.getByText("Something is wrong with the data.")).toBeInTheDocument()
    expect(screen.getByLabelText("Position for Sam Okafor")).toBeDisabled()
    expect(screen.getByRole("button", { name: "Add a person" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Remove Sam Okafor" })).toBeDisabled()
  })

  it("names a row with no name yet by its place", () => {
    render(<WhipCountDataField {...props} />)
    fireEvent.click(screen.getByRole("button", { name: "Add a person" }))
    expect(screen.getByLabelText("Name for row 12")).toHaveValue("")
  })
})
