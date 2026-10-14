import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { PluginSwitchField } from "../PluginSwitchField"

let mockValue: boolean | undefined
let mockDisabled = false
const setValue = vi.fn()
const useField = vi.fn()

vi.mock("@payloadcms/ui", () => ({
  useField: (args: unknown) => {
    useField(args)
    return { value: mockValue, setValue, disabled: mockDisabled }
  },
}))

describe("PluginSwitchField", () => {
  beforeEach(() => {
    mockValue = false
    mockDisabled = false
    setValue.mockClear()
    useField.mockClear()
  })

  it("shows the plugin's checkbox as a switch named for the plugin", () => {
    mockValue = true
    render(<PluginSwitchField name="Help docs" path="switches.docs" />)
    expect(useField).toHaveBeenCalledWith({ path: "switches.docs" })
    expect(screen.getByRole("switch", { name: "Help docs" })).toBeChecked()
  })

  it("sets the form's value when flipped", () => {
    render(<PluginSwitchField name="Help docs" path="switches.docs" />)
    fireEvent.click(screen.getByRole("switch", { name: "Help docs" }))
    expect(setValue).toHaveBeenCalledWith(true)
  })

  it("is disabled while the form is", () => {
    mockDisabled = true
    render(<PluginSwitchField name="Help docs" path="switches.docs" />)
    expect(screen.getByRole("switch", { name: "Help docs" })).toHaveAttribute(
      "aria-disabled",
      "true",
    )
  })
})
