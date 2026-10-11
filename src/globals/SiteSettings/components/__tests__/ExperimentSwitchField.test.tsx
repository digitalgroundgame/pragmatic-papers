import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import type { CheckboxFieldClientProps } from "payload"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { ExperimentSwitchField } from "../ExperimentSwitchField"

let mockValue: boolean | undefined
let mockDisabled = false
const setValue = vi.fn()

vi.mock("@payloadcms/ui", () => ({
  useField: () => ({ value: mockValue, setValue, disabled: mockDisabled }),
  useTranslation: () => ({ i18n: { language: "en" } }),
}))

function props(field: Partial<CheckboxFieldClientProps["field"]> = {}, readOnly = false) {
  return {
    path: "experiments.ticker",
    readOnly,
    field: {
      name: "ticker",
      label: "Ticker",
      admin: { description: "The strip under the header." },
      ...field,
    },
  } as CheckboxFieldClientProps
}

describe("ExperimentSwitchField", () => {
  beforeEach(() => {
    mockValue = false
    mockDisabled = false
    setValue.mockClear()
  })

  afterEach(cleanup)

  it("shows the field's label and description on a switch", () => {
    render(<ExperimentSwitchField {...props()} />)
    const toggle = screen.getByRole("switch", { name: "Ticker" })
    expect(toggle).not.toBeChecked()
    expect(toggle).toHaveAccessibleDescription("The strip under the header.")
  })

  it("writes the new boolean to the form", () => {
    render(<ExperimentSwitchField {...props()} />)
    fireEvent.click(screen.getByRole("switch", { name: "Ticker" }))
    expect(setValue).toHaveBeenCalledWith(true)
  })

  it("is on when the stored value is true", () => {
    mockValue = true
    render(<ExperimentSwitchField {...props()} />)
    expect(screen.getByRole("switch", { name: "Ticker" })).toBeChecked()
  })

  it("picks the admin's language from a translated label and description", () => {
    render(
      <ExperimentSwitchField
        {...props({
          label: { de: "Laufband", en: "Ticker" },
          admin: { description: { de: "Der Streifen.", en: "The strip." } },
        })}
      />,
    )
    expect(screen.getByRole("switch", { name: "Ticker" })).toHaveAccessibleDescription("The strip.")
  })

  it("falls back to the field name without a label, and drops a description function", () => {
    render(
      <ExperimentSwitchField
        {...props({ label: undefined, admin: { description: (() => "x") as never } })}
      />,
    )
    const toggle = screen.getByRole("switch", { name: "ticker" })
    expect(toggle).not.toHaveAttribute("aria-describedby")
  })

  it("is disabled when the field is read-only or the form disables it", () => {
    const { unmount } = render(<ExperimentSwitchField {...props({}, true)} />)
    expect(screen.getByRole("switch", { name: "Ticker" })).toHaveAttribute("aria-disabled", "true")
    unmount()
    mockDisabled = true
    render(<ExperimentSwitchField {...props()} />)
    expect(screen.getByRole("switch", { name: "Ticker" })).toHaveAttribute("aria-disabled", "true")
  })
})
