import { cleanup, render, screen } from "@testing-library/react"
import type { RelationshipFieldClientProps } from "payload"
import { afterEach, describe, expect, it, vi } from "vitest"

import { NarratorField } from "../NarratorField"

type MockFields = Record<string, { value?: unknown } | undefined>

let mockFields: MockFields = {}

// `useFormFields` is a subscription to the admin form's client state. Drive the
// selector off a per-test fixture so each upload scenario can be reproduced.
vi.mock("@payloadcms/ui", () => ({
  useFormFields: <T,>(selector: (args: [MockFields, unknown]) => T): T =>
    selector([mockFields, vi.fn()]),
}))

vi.mock("@payloadcms/ui/fields/Relationship", () => ({
  RelationshipField: () => <div data-testid="relationship-field" />,
}))

const props = { field: { name: "narrator" }, path: "narrator" } as RelationshipFieldClientProps

const renderWith = (fields: MockFields) => {
  mockFields = fields
  render(<NarratorField {...props} />)
}

const narratorField = () => screen.queryByTestId("relationship-field")

afterEach(() => {
  cleanup()
  mockFields = {}
})

describe("NarratorField", () => {
  it("shows for a pending audio file that has not been saved yet", () => {
    renderWith({ file: { value: { type: "audio/mpeg" } } })

    expect(narratorField()).toBeTruthy()
  })

  it("shows for a saved audio record", () => {
    renderWith({ mimeType: { value: "audio/mpeg" } })

    expect(narratorField()).toBeTruthy()
  })

  it("hides for a pending image file", () => {
    renderWith({ file: { value: { type: "image/jpeg" } } })

    expect(narratorField()).toBeNull()
  })

  it("hides for a saved image record", () => {
    renderWith({ mimeType: { value: "image/jpeg" } })

    expect(narratorField()).toBeNull()
  })

  it("hides on a blank form with no file selected", () => {
    renderWith({})

    expect(narratorField()).toBeNull()
  })

  it("prefers the pending file over the saved mimeType when a file is replaced", () => {
    renderWith({ file: { value: { type: "image/jpeg" } }, mimeType: { value: "audio/mpeg" } })

    expect(narratorField()).toBeNull()
  })
})
