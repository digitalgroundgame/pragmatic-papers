import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { Field, FieldDescription, FieldError, FieldLabel, FieldSet, FieldTitle } from "../field"

describe("Field", () => {
  it("renders with vertical orientation (default)", () => {
    const { container } = render(
      <Field>
        <FieldLabel htmlFor="name">Name</FieldLabel>
      </Field>,
    )
    expect(container.firstChild).toMatchSnapshot()
  })

  it("renders with horizontal orientation", () => {
    const { container } = render(
      <Field orientation="horizontal">
        <FieldLabel htmlFor="agree">Agree</FieldLabel>
      </Field>,
    )
    expect(container.firstChild).toMatchSnapshot()
  })
})

describe("FieldLabel", () => {
  it("renders with text", () => {
    const { container } = render(<FieldLabel htmlFor="email">Email</FieldLabel>)
    expect(container.firstChild).toMatchSnapshot()
  })
})

describe("FieldTitle", () => {
  it("renders with text", () => {
    const { container } = render(<FieldTitle>Section title</FieldTitle>)
    expect(container.firstChild).toMatchSnapshot()
  })
})

describe("FieldDescription", () => {
  it("renders with text", () => {
    const { container } = render(<FieldDescription>Helper text here.</FieldDescription>)
    expect(container.firstChild).toMatchSnapshot()
  })
})

describe("FieldError", () => {
  it("renders with children", () => {
    const { container } = render(<FieldError>This field is required.</FieldError>)
    expect(container.firstChild).toMatchSnapshot()
  })

  it("renders a single error from the errors prop", () => {
    const { container } = render(<FieldError errors={[{ message: "Too short" }]} />)
    expect(container.firstChild).toMatchSnapshot()
  })

  it("renders multiple errors as a list", () => {
    const { container } = render(
      <FieldError errors={[{ message: "Too short" }, { message: "Invalid characters" }]} />,
    )
    expect(container.firstChild).toMatchSnapshot()
  })

  it("renders nothing when errors is empty", () => {
    const { container } = render(<FieldError errors={[]} />)
    expect(container.firstChild).toBeNull()
  })
})

describe("FieldSet", () => {
  it("renders with children", () => {
    const { container } = render(
      <FieldSet>
        <Field>
          <FieldLabel htmlFor="f1">Field one</FieldLabel>
        </Field>
      </FieldSet>,
    )
    expect(container.firstChild).toMatchSnapshot()
  })
})
