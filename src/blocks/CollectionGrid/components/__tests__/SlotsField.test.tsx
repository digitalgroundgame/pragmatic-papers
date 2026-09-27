import { cleanup, render } from "@testing-library/react"
import type { ArrayFieldClientProps } from "payload"
import { afterEach, describe, expect, it, vi } from "vitest"

import { SlotsField } from "../SlotsField"

type FormFields = Record<string, { value?: unknown }>

const baseProps = {} as unknown as ArrayFieldClientProps

let formFieldsValue: FormFields = {}

vi.mock("@payloadcms/ui", () => ({
  useFormFields: (selector: (state: [FormFields]) => unknown) => selector([formFieldsValue]),
  ArrayField: ({ field }: { field: { minRows?: number; maxRows?: number } }) => (
    <div data-testid="array-field" data-min-rows={field.minRows} data-max-rows={field.maxRows} />
  ),
}))

afterEach(() => {
  cleanup()
  formFieldsValue = {}
})

const slotCounts = { "gauss-10": [8, 10] as [number, number] }

describe("SlotsField", () => {
  it("locks minRows/maxRows to [0, 0] when no layout is selected", () => {
    const { getByTestId } = render(
      <SlotsField {...baseProps} path="slots" slotCounts={slotCounts} />,
    )
    const el = getByTestId("array-field")
    expect(el.dataset.minRows).toBe("0")
    expect(el.dataset.maxRows).toBe("0")
  })

  it("locks minRows/maxRows to the selected layout's range", () => {
    formFieldsValue = { layout: { value: "gauss-10" } }
    const { getByTestId } = render(
      <SlotsField {...baseProps} path="slots" slotCounts={slotCounts} />,
    )
    const el = getByTestId("array-field")
    expect(el.dataset.minRows).toBe("8")
    expect(el.dataset.maxRows).toBe("10")
  })

  it("derives the sibling layout field path from a nested slots path", () => {
    formFieldsValue = { "collectionGrid.layout": { value: "gauss-10" } }
    const { getByTestId } = render(
      <SlotsField {...baseProps} path="collectionGrid.slots" slotCounts={slotCounts} />,
    )
    expect(getByTestId("array-field").dataset.minRows).toBe("8")
  })

  it("locks minRows/maxRows to [0, 0] for an unrecognized layout", () => {
    formFieldsValue = { layout: { value: "retired-layout" } }
    const { getByTestId } = render(
      <SlotsField {...baseProps} path="slots" slotCounts={slotCounts} />,
    )
    const el = getByTestId("array-field")
    expect(el.dataset.minRows).toBe("0")
    expect(el.dataset.maxRows).toBe("0")
  })
})
