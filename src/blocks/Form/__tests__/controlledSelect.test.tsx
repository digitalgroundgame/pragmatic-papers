import { render, screen, waitFor } from "@testing-library/react"
import { expect, it, vi } from "vitest"
import { FormProvider, useForm } from "react-hook-form"

import { Select } from "../Select"
import { chooseOption } from "./helpers"

// In a file of its own: Base UI logs each of its errors once per module load,
// so another test picking an option first would hide this one's.
it("keeps a select controlled from an empty field to a picked option", async () => {
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined)

  const Harness = (): React.ReactNode => {
    const methods = useForm()
    return (
      <FormProvider {...methods}>
        <Select
          blockType="select"
          control={methods.control}
          label="Favourite colour"
          name="colour"
          options={[
            { label: "Red", value: "red" },
            { label: "Blue", value: "blue" },
          ]}
        />
      </FormProvider>
    )
  }
  render(<Harness />)

  await chooseOption(screen.getByRole("combobox"), "Blue")
  await waitFor(() => expect(screen.getByRole("combobox").textContent).toContain("Blue"))

  // A field with no default value starts undefined. Handed to Base UI as is,
  // the select would start uncontrolled and turn controlled on the first pick.
  expect(consoleError).not.toHaveBeenCalled()
  consoleError.mockRestore()
})
