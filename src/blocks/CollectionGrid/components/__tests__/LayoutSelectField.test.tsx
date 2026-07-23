import { cleanup, render } from "@testing-library/react"
import type { SelectFieldClientProps } from "payload"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { LayoutSelectField } from "../LayoutSelectField"

const baseProps = {} as unknown as SelectFieldClientProps

type FormFields = Record<string, { value?: unknown; rows?: unknown[] }>

const addFieldRow = vi.fn()
const removeFieldRow = vi.fn()
let formFieldsValue: FormFields = {}

vi.mock("@payloadcms/ui", () => ({
  useForm: () => ({ addFieldRow, removeFieldRow }),
  useFormFields: (selector: (state: [FormFields]) => unknown) => selector([formFieldsValue]),
  SelectField: () => <div data-testid="select-field" />,
}))

beforeEach(() => {
  addFieldRow.mockClear()
  removeFieldRow.mockClear()
})

afterEach(() => {
  cleanup()
  formFieldsValue = {}
})

const slotCounts = { "gauss-10": [8, 10] as [number, number] }

function setSlots(rowCount: number) {
  formFieldsValue.slots = { rows: Array.from({ length: rowCount }) }
}

// The layout-change effect only fires relative to its *previous* value, so
// changing the layout requires a rerender rather than a fresh render.
describe("LayoutSelectField", () => {
  it("does not touch rows on initial mount, even if already out of range", () => {
    formFieldsValue = { layout: { value: "gauss-10" } }
    setSlots(2)
    render(
      <LayoutSelectField
        {...baseProps}
        path="layout"
        schemaPath="layout"
        slotCounts={slotCounts}
      />,
    )
    expect(addFieldRow).not.toHaveBeenCalled()
    expect(removeFieldRow).not.toHaveBeenCalled()
  })

  it("adds rows up to the minimum when the layout changes and too few rows are present", () => {
    formFieldsValue = { layout: { value: "bernoulli-left" } }
    setSlots(2)
    const { rerender } = render(
      <LayoutSelectField
        {...baseProps}
        path="layout"
        schemaPath="layout"
        slotCounts={slotCounts}
      />,
    )

    formFieldsValue.layout = { value: "gauss-10" }
    rerender(
      <LayoutSelectField
        {...baseProps}
        path="layout"
        schemaPath="layout"
        slotCounts={slotCounts}
      />,
    )

    expect(addFieldRow).toHaveBeenCalledTimes(6)
    expect(addFieldRow).toHaveBeenNthCalledWith(1, {
      path: "slots",
      rowIndex: 2,
      schemaPath: "slots",
    })
  })

  it("removes rows down to the maximum when the layout changes and too many rows are present", () => {
    formFieldsValue = { layout: { value: "bernoulli-left" } }
    setSlots(12)
    const { rerender } = render(
      <LayoutSelectField
        {...baseProps}
        path="layout"
        schemaPath="layout"
        slotCounts={slotCounts}
      />,
    )

    formFieldsValue.layout = { value: "gauss-10" }
    rerender(
      <LayoutSelectField
        {...baseProps}
        path="layout"
        schemaPath="layout"
        slotCounts={slotCounts}
      />,
    )

    expect(removeFieldRow).toHaveBeenCalledTimes(2)
  })

  it("does nothing when the layout changes but the row count is already within range", () => {
    formFieldsValue = { layout: { value: "bernoulli-left" } }
    setSlots(9)
    const { rerender } = render(
      <LayoutSelectField
        {...baseProps}
        path="layout"
        schemaPath="layout"
        slotCounts={slotCounts}
      />,
    )

    formFieldsValue.layout = { value: "gauss-10" }
    rerender(
      <LayoutSelectField
        {...baseProps}
        path="layout"
        schemaPath="layout"
        slotCounts={slotCounts}
      />,
    )

    expect(addFieldRow).not.toHaveBeenCalled()
    expect(removeFieldRow).not.toHaveBeenCalled()
  })

  it("does nothing when the layout changes to an unrecognized key", () => {
    formFieldsValue = { layout: { value: "bernoulli-left" } }
    setSlots(2)
    const { rerender } = render(
      <LayoutSelectField
        {...baseProps}
        path="layout"
        schemaPath="layout"
        slotCounts={slotCounts}
      />,
    )

    formFieldsValue.layout = { value: "retired-layout" }
    rerender(
      <LayoutSelectField
        {...baseProps}
        path="layout"
        schemaPath="layout"
        slotCounts={slotCounts}
      />,
    )

    expect(addFieldRow).not.toHaveBeenCalled()
    expect(removeFieldRow).not.toHaveBeenCalled()
  })
})
