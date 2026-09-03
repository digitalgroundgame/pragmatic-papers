import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { type FieldValues, FormProvider, type UseFormReturn, useForm } from "react-hook-form"

import { Country } from "../Country"
import { Select } from "../Select"
import { State } from "../State"
import { chooseOption } from "./helpers"

/**
 * Select, State and Country are the three fields that go through
 * react-hook-form's `Controller` rather than `register` — they wrap a Base UI
 * listbox that has no native form value of its own. These tests drive the
 * listbox the way a visitor would and assert the picked value reaches
 * `handleSubmit`, which is the part `Controller` is responsible for.
 */
function renderField(field: (methods: UseFormReturn) => React.ReactNode): {
  submitted: FieldValues[]
  submit: () => void
} {
  const submitted: FieldValues[] = []

  const Harness = (): React.ReactNode => {
    const methods = useForm()
    return (
      <FormProvider {...methods}>
        <form
          onSubmit={methods.handleSubmit((data) => {
            submitted.push(data)
          })}
        >
          {field(methods)}
          <button type="submit">Submit</button>
        </form>
      </FormProvider>
    )
  }

  render(<Harness />)

  return {
    submitted,
    submit: () => fireEvent.click(screen.getByRole("button", { name: "Submit" })),
  }
}

const colourOptions = [
  { label: "Red", value: "red" },
  { label: "Blue", value: "blue" },
]

afterEach(() => {
  cleanup()
})

describe("Select", () => {
  it("shows the label as the placeholder and lists the configured options", async () => {
    renderField((methods) => (
      <Select
        blockType="select"
        control={methods.control}
        errors={methods.formState.errors}
        label="Favourite colour"
        name="colour"
        options={colourOptions}
        required
      />
    ))

    const trigger = screen.getByRole("combobox")
    expect(trigger.textContent).toContain("Favourite colour")

    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false })
    fireEvent.pointerUp(trigger, { button: 0 })
    fireEvent.click(trigger)

    const options = await screen.findAllByRole("option")
    expect(options.map((option) => option.textContent)).toEqual(["Red", "Blue"])
  })

  it("submits the option the visitor picked", async () => {
    const { submitted, submit } = renderField((methods) => (
      <Select
        blockType="select"
        control={methods.control}
        errors={methods.formState.errors}
        label="Favourite colour"
        name="colour"
        options={colourOptions}
        required
      />
    ))

    await chooseOption(screen.getByRole("combobox"), "Blue")

    // The trigger shows the option's label, not the value stored behind it.
    await waitFor(() => expect(screen.getByRole("combobox").textContent).toContain("Blue"))

    submit()

    await waitFor(() => expect(submitted).toHaveLength(1))
    expect(submitted[0]).toEqual({ colour: "blue" })
  })

  it("keeps showing the placeholder until the visitor picks something", () => {
    renderField((methods) => (
      <Select
        blockType="select"
        control={methods.control}
        errors={methods.formState.errors}
        label="Favourite colour"
        name="colour"
        options={colourOptions}
        required
      />
    ))

    expect(screen.getByRole("combobox").textContent).toContain("Favourite colour")
  })

  it("blocks submission while a required select is untouched", async () => {
    const { submitted, submit } = renderField((methods) => (
      <Select
        blockType="select"
        control={methods.control}
        errors={methods.formState.errors}
        label="Favourite colour"
        name="colour"
        options={colourOptions}
        required
      />
    ))

    submit()

    await waitFor(() => expect(screen.getByText("This field is required")).toBeInTheDocument())
    expect(submitted).toHaveLength(0)
  })

  it("submits the configured default when the visitor leaves it alone", async () => {
    const { submitted, submit } = renderField((methods) => (
      <Select
        blockType="select"
        control={methods.control}
        defaultValue="red"
        errors={methods.formState.errors}
        label="Favourite colour"
        name="colour"
        options={colourOptions}
        required
      />
    ))

    expect(screen.getByRole("combobox").textContent).toContain("Red")

    submit()

    await waitFor(() => expect(submitted).toHaveLength(1))
    expect(submitted[0]).toEqual({ colour: "red" })
  })
})

describe("State", () => {
  it("submits the two-letter code for the state the visitor picked", async () => {
    const { submitted, submit } = renderField((methods) => (
      <State
        blockType="state"
        control={methods.control}
        errors={methods.formState.errors}
        label="State"
        name="state"
        required
      />
    ))

    await chooseOption(screen.getByRole("combobox"), "California")

    await waitFor(() => expect(screen.getByRole("combobox").textContent).toContain("California"))

    submit()

    await waitFor(() => expect(submitted).toHaveLength(1))
    expect(submitted[0]).toEqual({ state: "CA" })
  })

  it("keeps showing the placeholder before a state is picked", () => {
    renderField((methods) => (
      <State
        blockType="state"
        control={methods.control}
        errors={methods.formState.errors}
        label="State"
        name="state"
        required
      />
    ))

    // The field starts on an empty string; Base UI treats that as "nothing
    // selected", so the placeholder stands in until the visitor chooses.
    expect(screen.getByRole("combobox").textContent).toContain("State")
  })

  it("blocks submission while a required state is untouched", async () => {
    const { submitted, submit } = renderField((methods) => (
      <State
        blockType="state"
        control={methods.control}
        errors={methods.formState.errors}
        label="State"
        name="state"
        required
      />
    ))

    submit()

    await waitFor(() => expect(screen.getByText("This field is required")).toBeInTheDocument())
    expect(submitted).toHaveLength(0)
  })
})

describe("Country", () => {
  it("submits the ISO code for the country the visitor picked", async () => {
    const { submitted, submit } = renderField((methods) => (
      <Country
        blockType="country"
        control={methods.control}
        errors={methods.formState.errors}
        label="Country"
        name="country"
        required
      />
    ))

    await chooseOption(screen.getByRole("combobox"), "Canada")

    await waitFor(() => expect(screen.getByRole("combobox").textContent).toContain("Canada"))

    submit()

    await waitFor(() => expect(submitted).toHaveLength(1))
    expect(submitted[0]).toEqual({ country: "CA" })
  })
})
